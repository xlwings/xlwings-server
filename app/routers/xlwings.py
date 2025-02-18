import contextvars
import inspect
import json
import logging
from pathlib import Path
from textwrap import dedent
from typing import Optional

import xlwings as xw
import xlwings.server
from fastapi import APIRouter, Body, Header, Request, Response

from .. import custom_functions, custom_scripts, dependencies as dep
from ..config import settings
from ..models import CurrentUser
from ..templates import TemplateResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix=f"{settings.app_path}/xlwings")


@router.get("/alert")
async def alert(
    request: Request, prompt: str, title: str, buttons: str, mode: str, callback: str
):
    """Boilerplate required by book.app.alert() and to show unhandled exceptions"""
    return TemplateResponse(
        request=request,
        name="xlwings_alert.html",
        context={
            "prompt": prompt,
            "title": title,
            "buttons": buttons,
            "mode": mode,
            "callback": callback,
            "settings": settings,
        },
    )


@router.get("/custom-functions-meta")
@router.get("/custom-functions-meta.json")
async def custom_functions_meta():
    return xlwings.server.custom_functions_meta(
        custom_functions, typehinted_params_to_exclude=[CurrentUser]
    )


@router.get("/custom-functions-code")
@router.get("/custom-functions-code.js")
async def custom_functions_code():
    custom_functions_call_path = f"{settings.app_path}/xlwings/custom-functions-call"
    js = (settings.static_dir / "js" / "core" / "custom-functions-code.js").read_text()
    # format string would require to double all curly braces
    js = js.replace("placeholder_xlwings_version", xw.__version__).replace(
        "placeholder_custom_functions_call_path", custom_functions_call_path
    )
    for name, obj in inspect.getmembers(custom_functions):
        if hasattr(obj, "__xlfunc__"):
            xlfunc = obj.__xlfunc__
            func_name = xlfunc["name"]
            streaming = "true" if inspect.isasyncgenfunction(obj) else "false"
            js += dedent(
                f"""\
            async function {func_name}() {{
                let args = ["{func_name}", {streaming}]
                args.push.apply(args, arguments);
                return await base.apply(null, args);
            }}
            CustomFunctions.associate("{func_name.upper()}", {func_name});
            """
            )
    return Response(
        content=js,
        media_type="text/javascript",
    )


# ContextVars
socketio_id_context = contextvars.ContextVar("socketio_id_context")
caller_address_context = contextvars.ContextVar("caller_address_context")
redis_client_context = contextvars.ContextVar("redis_client_context")


@router.post("/custom-functions-call")
async def custom_functions_call(
    current_user: dep.User,
    redis_client: dep.RedisClient,
    data: dict = Body,
    sid: Optional[str] = Header(default=None),
):
    logger.info(f"""Function "{data['func_name']}" called by {current_user.name}""")
    socketio_id_context.set(sid)  # For utils.trigger_script()
    caller_address_context.set(data["caller_address"])  # For ObjectCache converter
    redis_client_context.set(redis_client)  # For ObjectCache converter

    rv = await xlwings.server.custom_functions_call(
        data,
        custom_functions,
        current_user,
        typehint_to_value={CurrentUser: current_user},
    )
    return {"result": rv}


@router.post("/custom-scripts-call/{script_name}")
async def custom_scripts_call(script_name: str, book: dep.Book, current_user: dep.User):
    logger.info(f"""Script "{script_name}" called by {current_user.name}""")
    book = await xlwings.server.custom_scripts_call(
        custom_scripts,
        script_name,
        current_user,
        typehint_to_value={CurrentUser: current_user, xw.Book: book},
    )
    return book.json()


@router.get("/custom-scripts-sheet-buttons")
@router.get("/custom-scripts-sheet-buttons.js")
async def custom_scripts_sheet_buttons():
    buttons_info = []
    for name, func in inspect.getmembers(custom_scripts, inspect.isfunction):
        target_cell = getattr(func, "target_cell", None)
        config = getattr(func, "config", {})
        if target_cell:
            buttons_info.append([target_cell, name, config])
    content = f"const cellsToScripts = {json.dumps(buttons_info)};"
    return Response(content=content, media_type="application/javascript")


if settings.enable_lite:

    @router.get("/pyodide.json")
    async def get_pyodide_config():
        # requirements.txt
        packages = (
            Path(settings.base_dir / "lite" / "requirements.txt")
            .read_text()
            .splitlines()
        )
        packages = [
            pkg.replace("/static", settings.static_url_path).strip()
            for pkg in packages
            if pkg.strip()
        ]

        # Files
        def scan_directory(
            base_dir: Path, dir_name: str, prepend_dir_name: bool = False
        ) -> dict:
            dir_path = Path(settings.base_dir / dir_name)
            files = {}
            if dir_path.exists():
                for file_path in dir_path.rglob("*"):
                    if (
                        file_path.is_file()
                        and file_path.suffix != ".pyc"
                        and file_path.name != "requirements.txt"
                    ):
                        relative_path = file_path.relative_to(dir_path)
                        files[
                            f"{settings.static_url_path.replace('static', dir_name)}/{relative_path}"
                        ] = (
                            f"./{dir_name}/{relative_path}"
                            if prepend_dir_name
                            else f"./{relative_path}"
                        )
            return files

        # Scan all directories
        files = {}
        files.update(scan_directory(settings.base_dir, "lite"))
        for directory in ["custom_functions", "custom_scripts"]:
            files.update(
                scan_directory(settings.base_dir, directory, prepend_dir_name=True)
            )
        response = {"packages": packages, "files": files}
        return response
