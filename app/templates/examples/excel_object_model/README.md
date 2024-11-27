# Manipulating the Excel Object Model from the Task Pane

This example demonstrates how to manipulate Excel using htmx. You can enter a name in the text box and after clicking the button, it will add it to the bottom of column A in the active sheet.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Form, Request

from .. import dependencies as dep
from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="examples/excel_object_model/add_name_form.html",
    )


@router.post("/name")
async def name(request: Request, book: dep.Book, name: str = Form(None)):
    # Error handling
    error = "Please provide a name!" if name == "" else None

    # Excel manipulations
    sheet = book.sheets.active
    row_ix = sheet["A1"].end("down").row if sheet["A1"].value else 0
    book.sheets.active[row_ix, 0].value = name

    # Include your book object as "book" in the context
    return TemplateResponse(
        request=request,
        name="examples/excel_object_model/add_name_form.html",
        context={
            "error": error,
            "book": book,
        },
        block_names="content",
    )
```

This sample also depends on:

- `static/js/core/htmx-handlers.js`
- `templates/_book.html`
