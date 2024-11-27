# htmx form sample

This example uses a Bootstrap form, adopted from:
https://getbootstrap.com/docs/5.3/forms/overview/#overview

- It sends the content of the input field (requires a "name" tag) to the backend using [htmx](https://htmx.org/)
- On the backend, it calls a custom function and
- returns the result via the `_greeting.html` template. The leading underscore means that it is a partial HTML snippet, not a full page.
- Back on the frontend, htmx takes care of displaying that HTML snippet in the `#result` div via `hx-target` tag.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Form, Request

from .. import custom_functions
from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="examples/htmx_form/taskpane_htmx_form.html",
    )


@router.post("/hello")
async def hello(request: Request, fullname: str = Form()):
    error = "Please provide a name!" if not fullname else None
    greeting = custom_functions.hello(fullname)
    return TemplateResponse(
        request=request,
        name="examples/htmx_form/_greeting.html",
        context={"greeting": greeting, "error": error},
    )
```

This sample also depends on:

- no dependencies
