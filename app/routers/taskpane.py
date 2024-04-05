from fastapi import APIRouter, HTTPException, Request

from ..config import settings
from ..templates import TemplateResponse

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

    return TemplateResponse(
        request=request,
        name=template,
        context={"settings": settings},
    )
