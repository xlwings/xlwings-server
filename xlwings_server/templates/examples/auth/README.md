# Task pane authentication with htmx

- The task pane landing page has to be publicly accessible.
- Everything else can be locked down using the `dep.User` dependency.
- Since it is htmx that provides the `Authorization` header with every request, you'll end up with an authentication error if you use `hx-push-url="true"` or `hx-boost="true"` when right-clicking on the task pane and selecting `Reload`. This happens also with hot-reloading during development. The reason is that a full page reload isn't handled by htmx, which means that the Authorization header is missing. Therefore, the example doesn't push the url: you won't see any authentication errors when reloading, but in return, a reload always brings you back to the landing page.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Request

from .. import dependencies as dep
from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="examples/auth/public.html",
    )


@router.get("/taskpane/protected")
async def taskpane_protected(request: Request, current_user: dep.User):
    return TemplateResponse(
        request=request,
        name="examples/auth/protected.html",
        context={"current_user": current_user},
    )
```

This sample also depends on:

- `app/static/js/htmx-handlers.js`
