from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..utils import templates

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request, app: str = None):
    if not app:
        template = "taskpane_loader.html"
    elif app == "1":
        template = "taskpane1.html"
    elif app == "2":
        template = "taskpane2.html"
    else:
        raise HTTPException(status_code=400, detail="Invalid app value")

    return templates.TemplateResponse(
        template,
        {"request": request, "settings": settings},
    )
