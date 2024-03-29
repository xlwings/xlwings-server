import logging

import markupsafe
import xlwings as xw
from fastapi import APIRouter, Body, Depends, Request, Response

from .. import custom_functions
from ..auth.entraid import get_user
from ..utils import templates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/xlwings")


@router.get("/alert")
async def alert(
    request: Request, prompt: str, title: str, buttons: str, mode: str, callback: str
):
    """Boilerplate required by book.app.alert() and to show unhandled exceptions"""
    return templates.TemplateResponse(
        "xlwings-alert.html",
        {
            "request": request,
            "prompt": markupsafe.escape(prompt).replace(
                "\n", markupsafe.Markup("<br>")
            ),
            "title": title,
            "buttons": buttons,
            "mode": mode,
            "callback": callback,
        },
    )


@router.get("/custom-functions-meta")
async def custom_functions_meta():
    return xw.server.custom_functions_meta(custom_functions)


@router.get("/custom-functions-code")
async def custom_functions_code():
    return Response(
        content=xw.server.custom_functions_code(custom_functions),
        media_type="text/javascript",
    )


@router.post("/custom-functions-call")
async def custom_functions_call(
    request: Request, data: dict = Body, current_user=Depends(get_user)
):
    logger.info(f"""Function "{data['func_name']}" called by {current_user.name}""")
    rv = await xw.server.custom_functions_call(data, custom_functions)
    return {"result": rv}
