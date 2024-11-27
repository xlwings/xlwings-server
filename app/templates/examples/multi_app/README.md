# Multiple Apps

This example loads a different task pane depending on the name of the workbook.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane")
@router.get("/taskpane.html")
async def taskpane(request: Request, app: str = None):
    if not app:
        template = "examples/multi_app/taskpane_loader.html"
    elif app == "1":
        template = "examples/multi_app/taskpane1.html"
    elif app == "2":
        template = "examples/multi_app/taskpane2.html"

    return TemplateResponse(
        request=request,
        name=template,
    )
```

The sample also depends on:

- `app/static/js/core/examples.js`
