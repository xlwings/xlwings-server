from fastapi import APIRouter, Request

from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request, name="/examples/hello_world/taskpane_hello.html"
    )
