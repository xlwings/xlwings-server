import json
import logging
from functools import cache

import socketio
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from xlwings import XlwingsError

from . import settings
from .object_handles import ObjectCacheConverter
from .routers import socketio as socketio_router
from .routers.manifest import router as manifest_router
from .routers.root import router as root_router
from .routers.taskpane import router as taskpane_router
from .routers.xlwings import router as xlwings_router
from .templates import templates

# Logging
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

# App
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# Starlette's url_for returns fully qualified URLs causing issues if the reverse proxy
# handles TLS and the app runs on http (https://github.com/encode/starlette/issues/843)
templates.env.globals["url_for"] = app.url_path_for

# Register Converter
ObjectCacheConverter.register(object, "object", "obj")

# CORS: Office Scripts and custom functions in Excel on the web require CORS
# Using app.add_middleware won't add the CORS headers if you handle the root "Exception"
# in an exception handler (it would require a specific exception type).
cors_app = CORSMiddleware(
    app=app,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["POST"],
    allow_headers=["*"],
    allow_credentials=False,
)
main_app = cors_app

# Socket.io
if settings.enable_socketio:
    sio_app = socketio.ASGIApp(
        socketio_router.sio,
        # Only forward ASGI traffic if there's no message queue and hence 1 worker setup
        cors_app if not settings.socketio_message_queue_url else None,
        socketio_path=f"{settings.app_path}/socket.io",
    )
    main_app = sio_app if not settings.socketio_message_queue_url else cors_app


# Routers
app.include_router(root_router)
app.include_router(xlwings_router)
app.include_router(taskpane_router)
app.include_router(manifest_router)


# Security headers
@cache
def read_security_headers():
    with open(settings.base_dir / "security_headers.json", "r") as f:
        data = json.load(f)
    return data


@app.middleware("http")
async def add_security_headers(request, call_next):
    # https://owasp.org/www-project-secure-headers/index.html#configuration-proposal
    # https://owasp.org/www-project-secure-headers/ci/headers_add.json
    response = await call_next(request)
    if settings.add_security_headers:
        data = read_security_headers()

        # Extract file extension from request URL
        file_ext = request.url.path.split(".")[-1].lower()
        image_ext = ("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg")

        for header in data["headers"]:
            # Excel on Windows doesn't display the icons in the ribbon otherwise
            if header["name"] == "Cache-Control" and file_ext in image_ext:
                continue
            if header["name"] not in ("Permissions-Policy", "Clear-Site-Data"):
                # Permissions-Policy headers are experimental
                # Clear-Site-Data is too aggressive
                response.headers[header["name"]] = header["value"]
        # For example, Bootstrap alerts need this
        response.headers["Content-Security-Policy"] = (
            response.headers["Content-Security-Policy"] + "; img-src 'self' data:"
        )
        if settings.enable_excel_online:
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            response.headers["Content-Security-Policy"] = response.headers[
                "Content-Security-Policy"
            ].replace("frame-ancestors 'none'; ", "")
            response.headers["Content-Security-Policy"] = (
                response.headers["Content-Security-Policy"]
                + "; font-src 'self' https://res-1.cdn.office.net; style-src 'self' 'unsafe-inline';"
            )
            del response.headers["X-Frame-Options"]
        if settings.public_addin_store:
            response.headers["Content-Security-Policy"] = (
                response.headers["Content-Security-Policy"]
                + "; script-src 'self' https://appsforoffice.microsoft.com;"
            )
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            del response.headers["Cross-Origin-Embedder-Policy"]
    return response


# Static files: in prod might be served by something like nginx or via
# https://github.com/matthiask/blacknoise or https://github.com/Archmonger/ServeStatic
app.mount(
    settings.static_url_path,
    StaticFiles(directory=settings.static_dir),
    name="static",
)
if settings.environment == "dev":
    # Don't cache static files
    StaticFiles.is_not_modified = lambda *args, **kwargs: False


# Exception handlers
@app.exception_handler(XlwingsError)
async def xlwings_exception_handler(request, exception):
    logger.error(exception)
    msg = str(exception)
    return PlainTextResponse(msg, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@app.exception_handler(Exception)
async def exception_handler(request, exception):
    logger.error(exception)
    if settings.environment == "dev":
        msg = repr(exception)
    else:
        msg = "An error ocurred."
    return PlainTextResponse(msg, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
