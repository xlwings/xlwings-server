import json
import logging
from functools import cache

import socketio
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import settings
from .routers import socketio as socketio_router
from .routers.macros import router as macros_router
from .routers.taskpane import router as taskpane_router
from .routers.xlwings import router as xlwings_router

# Logging
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

# App
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# Routers
app.include_router(xlwings_router)
app.include_router(macros_router)
app.include_router(taskpane_router)

# CORS: Office Scripts and custom functions in Excel on the web require CORS
# Using app.add_middleware won't add the CORS headers if you handle the root "Exception"
# in an exception handler (it would require a specific exception type).
cors_app = CORSMiddleware(
    app=app,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["POST"],
    allow_headers=["*"],  # TODO
)

# Socket.io
sio_app = socketio.ASGIApp(socketio_router.sio, cors_app)


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

        for header in data["headers"]:
            if header["name"] not in ("Permissions-Policy", "Clear-Site-Data"):
                # Permissions-Policy headers are experimental
                # Clear-Site-Data is too aggressive
                response.headers[header["name"]] = header["value"]
        if settings.public_addin_store:
            response.headers["Content-Security-Policy"] = (
                response.headers["Content-Security-Policy"]
                + "; script-src 'self' https://appsforoffice.microsoft.com;"
            )
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            del response.headers["Cross-Origin-Embedder-Policy"]
    return response


# Endpoints
@app.get("/")
async def root():
    # This endpoint could be used for a health check
    return {"status": "ok"}


# Static files: in prod should be served via a HTTP server like nginx if possible
app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")
if settings.development:
    # Don't cache static files
    StaticFiles.is_not_modified = lambda *args, **kwargs: False


# Exception handlers
@app.exception_handler(Exception)
async def exception_handler(request, exception):
    logger.error(exception)
    if settings.development:
        msg = repr(exception)
    else:
        msg = "An error ocurred."
    return PlainTextResponse(msg, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
