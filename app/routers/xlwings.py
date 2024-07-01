import logging

import xlwings.server
from fastapi import APIRouter, Body, Request, Response

from .. import custom_functions, custom_scripts, dependencies as dep
from ..config import settings
from ..templates import TemplateResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/xlwings")


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
async def custom_functions_meta():
    return xlwings.server.custom_functions_meta(custom_functions)


@router.get("/custom-functions-code")
async def custom_functions_code():
    return Response(
        content=xlwings.server.custom_functions_code(
            custom_functions,
            custom_functions_call_path=f"{settings.app_path}/xlwings/custom-functions-call",
        ),
        media_type="text/javascript",
    )


@router.post("/custom-functions-call")
async def custom_functions_call(
    current_user: dep.User,
    data: dict = Body,
):
    logger.info(f"""Function "{data['func_name']}" called by {current_user.name}""")
    rv = await xlwings.server.custom_functions_call(data, custom_functions)
    return {"result": rv}


@router.post("/custom-scripts-call/{script_name}")
async def custom_scripts_call(script_name: str, book: dep.Book, current_user: dep.User):
    logger.info(f"""Script "{script_name}" called by {current_user.name}""")
    book = await xlwings.server.custom_scripts_call(custom_scripts, script_name, book)
    return book.json()
