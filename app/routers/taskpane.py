from fastapi import APIRouter, Request

from ..utils import templates

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return templates.TemplateResponse(
        "taskpane.html",
        {"request": request},
    )
