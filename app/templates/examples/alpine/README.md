# Alpine.js sample

This example demonstrates a few common Alpine.js features. They are explained on the task pane itself.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="examples/alpine/taskpane.html",
    )
```

This sample also depends on:

- `app/static/js/core/examples.js`
