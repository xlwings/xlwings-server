from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="/examples/hello_world_taskpane.html",
        context={"settings": settings},
    )
