from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request, name="examples/hello_world/taskpane_hello.html"
    )
