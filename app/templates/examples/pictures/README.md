# Pictures via htmx and Bootstrap dropdown

This sample populates a Bootstrap dropdown (see https://getbootstrap.com/docs/5.3/components/dropdowns/#single-button) with the names of the png pictures in the `app/static/images/ribbon/examples` directory.
When you select a picture name from the dropdown, it displays it below.

To try it out, replace `app/routers/taskpane.py` with the following code:

```python
from fastapi import APIRouter, Form, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane")
@router.get("/taskpane.html")
async def taskpane(request: Request):
    directory = settings.static_dir / "images" / "ribbon" / "examples"
    picture_names = []
    for path in directory.glob("*.png"):
        picture_names.append(path.name)
    return TemplateResponse(
        request=request,
        name="examples/pictures/taskpane_pictures.html",
        context={"picture_names": picture_names},
    )


@router.post("/picture")
async def picture(request: Request, picture_name: str = Form(None)):
    return TemplateResponse(
        request=request,
        name="examples/pictures/_picture.html",
        context={"picture_name": picture_name},
    )
```

This sample also depends on:

- pictures in `app/static/images/ribbon/examples`
