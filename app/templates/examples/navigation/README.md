# Navigation via htmx and Bootstrap

This sample uses a Bootstrap nav (see https://getbootstrap.com/docs/5.3/components/navs-tabs/#underline) to navigate between 3 different pages, but using only a single taskpane. It makes use of the htmx tag `hx-boost`, which converts traditional anchor tags into partial page loads.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane.html")
@router.get("/taskpane/{page}")
async def taskpane(request: Request, page: str = "one"):
    return TemplateResponse(
        request=request,
        name=f"examples/navigation/taskpane_{page}.html",
        context={"page": page},
    )
```

This sample also depends on:

- no dependencies
