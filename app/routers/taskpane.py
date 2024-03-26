from fastapi import APIRouter, Request

from ..config import settings
from ..utils import templates

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return templates.TemplateResponse(
        "taskpane.html",
        {"request": request, "settings": settings},
    )
