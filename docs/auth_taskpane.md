# Task Pane Authentication

By setting `XLWINGS_AUTH_PROVIDERS` in the [](server_config.md), xlwings Server will authentication calls to [](custom_functions.md) and [](custom_scripts.md). Since the task pane is completely customizable, it is your responsibility to lock down the desired endpoints:

- The landing page of the task pane needs to be publicly available
- The rest of the pages can be locked down using the `User` dependency injection (using a custom router via `uv run xlwings-server add router`):

  ```python
  from fastapi import APIRouter, Request

  from xlwings_server import settings, dependencies as dep
  from xlwings_server.templates import TemplateResponse

  router = APIRouter(prefix=settings.app_path)


  @router.get("/taskpane/protected")
  async def taskpane_protected(request: Request, current_user: dep.User):
      return TemplateResponse(
          request=request,
          name="examples/auth/protected.html",
          context={"current_user": current_user},
      )

  ```

- You will need to provide the `Authorization` header with every request. For `htmx`, there is a sample included under [`xlwings_server/templates/examples/auth`](https://github.com/xlwings/xlwings-server/tree/main/xlwings_server/templates/examples/auth).
