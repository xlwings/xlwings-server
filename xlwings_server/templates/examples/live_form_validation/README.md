# Live Form Validation

This example demonstrates how to validate a form input live on the backend via htmx. If you provide a name that has less than 4 characters, you'll get a validation error shown.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Form, Request, status
from fastapi.responses import PlainTextResponse, Response

from .. import dependencies as dep
from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="examples/live_form_validation/add_name_form.html",
    )


def validate_name(name: str):
    if 0 < len(name) < 4:
        return "Name must have at least 4 characters!"


@router.post("/name")
async def name(request: Request, book: dep.Book, name: str = Form(None)):
    # Validation
    error = validate_name(name)
    if error:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # Excel manipulations
    sheet = book.sheets.active
    row_ix = sheet["A1"].end("down").row if sheet["A1"].value else 0
    book.sheets.active[row_ix, 0].value = name

    # Include your book object as "book" in the context
    return TemplateResponse(
        request=request,
        name="examples/live_form_validation/add_name_form.html",
        context={"book": book},
        block_names="content",
    )


@router.get("/name/validation")
async def validate_name_input(request: Request, name: str):
    error = validate_name(name)
    return PlainTextResponse(error if error else "&nbsp;")
```

This sample also depends on:

- `static/js/core/htmx-handlers.js`
- `templates/_book.html`
