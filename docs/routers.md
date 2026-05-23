# Custom Routers

xlwings Server is built on [FastAPI](https://fastapi.tiangolo.com/), so you can extend the server with your own HTTP endpoints by adding a custom [APIRouter](https://fastapi.tiangolo.com/reference/apirouter/). This is useful, for example, to serve additional task pane pages, expose JSON APIs to your add-in, or handle HTMX requests.

## Scaffold a custom router

To get started, run the following command in the root of your project:

```
uv run xlwings-server add router
```

This creates a `routers/` directory with an `__init__.py` and a sample `routers/custom.py`. xlwings Server automatically discovers and registers the `router` object from `routers/custom.py` at startup---no further wiring is required.

## The default `routers/custom.py`

The scaffold gives you two example endpoints---one returning JSON and one rendering a Jinja template---so you can verify that your router is wired up correctly:

```python
from fastapi import APIRouter, Request

from xlwings_server import settings
from xlwings_server.templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/hello-json")
async def hello_json():
    return {"message": "Hello from custom router!"}


@router.get("/hello-template")
async def hello_template(request: Request):
    return TemplateResponse(
        request=request,
        name="examples/hello_world/taskpane_hello.html",
    )
```

After starting the server, open https://127.0.0.1:8000/hello-json and https://127.0.0.1:8000/hello-template in a browser to confirm both endpoints work.

A few notes:

- The `prefix=settings.app_path` makes sure your endpoints respect the `XLWINGS_APP_PATH` setting when the server is hosted behind a reverse proxy under a non-root path.
- Use `xlwings_server.templates.TemplateResponse` (not FastAPI's `TemplateResponse`) so that your templates can resolve from both the project's `templates/` directory and the package defaults.

## Example: a custom Socket.io handler

The same `routers/custom.py` is also a convenient place to register additional [Socket.io](https://python-socketio.readthedocs.io/) event handlers. The `sio` instance is importable from `xlwings_server.routers.socketio`:

```python
import logging

from fastapi import APIRouter

from xlwings_server import settings
from xlwings_server.routers.socketio import sio

logger = logging.getLogger(__name__)

router = APIRouter(prefix=settings.app_path)


@sio.on("my_custom_event")
async def my_custom_event(sid, data):
    session = await sio.get_session(sid)
    current_user = session["current_user"]
    logger.info(f"my_custom_event from {current_user.name}: {data}")
    await sio.emit("my_custom_event_response", {"ok": True}, to=sid)
```

The `current_user` is populated by the built-in `connect` handler, so authentication is handled for you. To exercise this from the task pane, attach a listener and emit the event from your `main.js` via the `globalThis.socket` instance:

```js
globalThis.socket.on("my_custom_event_response", (data) => {
  console.log("got response from server:", data);
});

globalThis.testCustomEvent = () => {
  globalThis.socket.emit("my_custom_event", { hello: "world" });
};
```

Then, with the task pane open and the dev tools attached, run `testCustomEvent()` in the console. You should see the server log the event and the browser console log the response.

```{note}
Avoid defining your own `@sio.on("connect")` or `@sio.on("disconnect")` handler unless you really need to. `python-socketio` only keeps the last registration for a given event name, so a custom `connect` handler will **replace** the built-in one in [`xlwings_server/routers/socketio.py`](https://github.com/xlwings/xlwings-server/blob/main/xlwings_server/routers/socketio.py)---which is what authenticates the user and stores `current_user` in the session.
```
