# Alpine.js form sample

When you type in a name in the `First Name` and `Last Name` form fields, Alpine.js will live-update the `Full Name`.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="/examples/alpine_form/taskpane_form.html",
        context={"settings": settings},
    )
```

This sample also depends on:

- `app/static/js/core/examples.js`
