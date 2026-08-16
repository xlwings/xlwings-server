import contextvars
import inspect
import logging
from pathlib import Path
from textwrap import dedent

import xlwings as xw
import xlwings.server
from fastapi import APIRouter, Body, HTTPException, Request, Response

# Try to import custom modules from project directory first (CLI/Azure mode)
# Fall back to package location (tests/package mode)
try:
    import custom_functions
except ModuleNotFoundError:
    import xlwings_server.custom_functions as custom_functions

try:
    import custom_scripts
except ModuleNotFoundError:
    import xlwings_server.custom_scripts as custom_scripts

from xlwings_server import dependencies as dep
from xlwings_server.config import PACKAGE_DIR, settings
from xlwings_server.models import Caller, CurrentUser, caller_from_address
from xlwings_server.templates import TemplateResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix=f"{settings.app_path}/xlwings")


def sanitize_log_input(input_string: str) -> str:
    """Replaces newline and carriage return characters to prevent log injection."""
    if not isinstance(input_string, str):
        input_string = str(input_string)
    return input_string.replace("\n", "\\n").replace("\r", "\\r")


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
    js = (
        PACKAGE_DIR / "static" / "js" / "custom-functions" / "custom-functions-code.js"
    ).read_text()
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
redis_client_context = contextvars.ContextVar("redis_client_context")
# Only used when XLWINGS_OBJECT_CACHE_PARTITION_BY_USER is enabled (see object_handles).
user_id_context = contextvars.ContextVar("user_id_context", default=None)


@router.post("/custom-functions-call")
async def custom_functions_call(
    current_user: dep.User,
    redis_client: dep.RedisClient,
    data: dict = Body,
):
    # Replace newline and carriage return characters to prevent log injection
    safe_func_name = sanitize_log_input(data["func_name"])
    safe_user_name = sanitize_log_input(current_user.name)
    logger.info(f"""Function "{safe_func_name}" called by {safe_user_name}""")
    redis_client_context.set(redis_client)  # For ObjectCache converter
    user_id_context.set(
        current_user.id
    )  # For ObjectCache converter (when partitioning)

    # A malformed address must never fail the call itself: functions that don't use the
    # Caller hint are unaffected, and those that do receive None (see the Caller docstring).
    try:
        caller = caller_from_address(data.get("caller_address"))
    except xw.XlwingsError:
        safe_caller_address = sanitize_log_input(data.get("caller_address"))
        logger.warning(f"""Could not parse caller address "{safe_caller_address}\"""")
        caller = None

    try:
        rv = await xlwings.server.custom_functions_call(
            data,
            custom_functions,
            current_user,
            typehint_to_value={CurrentUser: current_user, Caller: caller},
        )
    except xw.ObjectCacheMissError:
        # A consumed object handle is no longer cached. Return a "stale" object handle
        # instead of an error so the user gets an actionable card (rather than a #VALUE!).
        # Imported here to avoid a circular import (object_handles imports this module).
        from xlwings_server import object_handles

        rv = object_handles.stale_object_handle()

    if isinstance(rv, xw.CustomFunctionResult):
        # The function requested a follow-up script via xw.WithScript. Validate the name
        # here (core doesn't know the project's custom_scripts) so an unknown script is a
        # clear error on the producing cell rather than a silent client-side no-op.
        script_name = rv.script["script_name"]
        # Check for the @script marker, not just the attribute: modules re-export plenty
        # of names (settings, np, Path, ...) that would pass a bare hasattr() and only
        # fail later, when the client dispatches the follow-up.
        meta = getattr(getattr(custom_scripts, script_name, None), "__xlscript__", None)
        if meta is None:
            safe_script_name = sanitize_log_input(script_name)
            raise HTTPException(
                status_code=400,
                detail=f"Custom script '{safe_script_name}' doesn't exist.",
            )

        # How much of the workbook to send, and whether to load it lazily, are properties
        # of the script (@script(include=...)/(exclude=...) and an xw.BookAsync book
        # parameter), not of the caller. Resolve them here from the same metadata that a
        # task pane button reads from custom-scripts-meta.json.
        def as_sheet_str(value):
            # @script accepts a list or a comma-separated string; the client splits on
            # "," so normalize lists here.
            if not value:
                return ""
            return ",".join(value) if isinstance(value, (list, tuple)) else value

        script = {
            **rv.script,
            "include": as_sheet_str(meta.get("include")),
            "exclude": as_sheet_str(meta.get("exclude")),
            "lazy": bool(meta.get("lazy")),
        }
        return {"result": rv.value, "script": script}
    return {"result": rv}


@router.post("/custom-scripts-call/{script_name}")
async def custom_scripts_call(
    script_name: str, args: dep.ScriptArgs, book: dep.Book, current_user: dep.User
):
    # Replace newline and carriage return characters to prevent log injection
    safe_script_name = sanitize_log_input(script_name)
    safe_user_name = sanitize_log_input(current_user.name)
    logger.info(f"""Script "{safe_script_name}" called by {safe_user_name}""")
    try:
        book = await xlwings.server.custom_scripts_call(
            custom_scripts,
            script_name,
            current_user,
            typehint_to_value={CurrentUser: current_user, xw.Book: book},
            args=args,
        )
    except xw.XlwingsError as e:
        error_msg = str(e)
        if "missing required argument" in error_msg or "extra argument" in error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        raise
    return book.json()


@router.get("/custom-scripts-meta")
@router.get("/custom-scripts-meta.json")
async def custom_scripts_meta():
    return xlwings.server.custom_scripts_meta(custom_scripts)


if settings.enable_wasm:

    @router.get("/pyodide.json")
    async def get_pyodide_config():
        # requirements.txt
        packages = (
            Path(settings.project_dir / "wasm" / "requirements.txt")
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
            dir_path = Path(settings.project_dir / dir_name)
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
        files.update(scan_directory(settings.project_dir, "wasm"))
        for directory in ["custom_functions", "custom_scripts"]:
            files.update(
                scan_directory(settings.project_dir, directory, prepend_dir_name=True)
            )
        response = {"packages": packages, "files": files}
        return response
