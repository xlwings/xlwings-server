from fastapi import APIRouter, Form, Request

from .. import custom_functions, dependencies as dep
from ..config import settings
from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="/examples/htmx_form/taskpane_htmx_form.html",
        context={"settings": settings},
    )


@router.post("/form-example")
async def form_example(request: Request, book: dep.Book, name: str = Form(None)):
    if name == "":
        error = "Please provide a name!"
    else:
        error = None
    greeting = custom_functions.hello(name)

    sheet = book.sheets.active
    if not sheet["A1"].value:
        last_row = 0
    else:
        last_row = sheet["A1"].expand("down").last_cell.row
    book.sheets.active[last_row, 0].value = name
    return TemplateResponse(
        request=request,
        name="/examples/htmx_form/taskpane_htmx_form.html",
        context={
            "settings": settings,
            "greeting": greeting,
            "error": error,
            "book": book,
        },
        block_names="content",
    )
