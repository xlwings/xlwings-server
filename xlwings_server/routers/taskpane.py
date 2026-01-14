from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane")
@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(request=request, name=settings.taskpane_html)
