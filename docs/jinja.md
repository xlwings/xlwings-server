# Jinja

Jinja is the templating engine used for creating your HTML files that define the task pane and load the necessary files for the add-in.

## First steps

In your `taskpane.py` file, you are returning

```python
from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="/examples/hello_world/taskpane_hello.html",
        context={"settings": settings},
    )
```

## Conventions

- Leading underscore

## Further Reading

- Docs: [jinja.palletsprojects.com](https://jinja.palletsprojects.com)
