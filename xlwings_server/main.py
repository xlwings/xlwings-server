import json
import logging
import os
import sys
from functools import cache
from pathlib import Path

import socketio
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from xlwings import XlwingsError

# CRITICAL: Setup sys.path for user overrides BEFORE importing user modules
# This is done here (not in CLI) so it works when uvicorn imports this module
if project_dir := os.getenv("XLWINGS_PROJECT_DIR"):
    project_dir = Path(project_dir)
    if str(project_dir) not in sys.path:
        sys.path.insert(0, str(project_dir))

from xlwings_server.config import PACKAGE_DIR, PROJECT_DIR, settings
from xlwings_server.object_handles import ObjectCacheConverter
from xlwings_server.routers import socketio as socketio_router
from xlwings_server.routers.manifest import router as manifest_router
from xlwings_server.routers.root import router as root_router
from xlwings_server.routers.taskpane import router as taskpane_router
from xlwings_server.routers.xlwings import router as xlwings_router
from xlwings_server.templates import templates

# Logging
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

logger.info(f"Running in '{'Wasm' if settings.enable_wasm else 'Server'}' mode.")

# App
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


# Starlette's url_for returns fully qualified URLs causing issues if the reverse proxy
# handles TLS and the app runs on http (https://github.com/encode/starlette/issues/843)
def url_for(name: str, **path_params):
    """Wrapper around url_path_for that strips leading slashes from path parameters"""
    if name == "static" and "path" in path_params:
        # Strip leading slash from static file paths to avoid double slashes
        path_params["path"] = path_params["path"].lstrip("/")
    return app.url_path_for(name, **path_params)


templates.env.globals["url_for"] = url_for

# Register Converter
ObjectCacheConverter.register(object, "object", "obj")


# Custom StaticFiles with file-level override support
class OverridableStaticFiles(StaticFiles):
    """StaticFiles that checks user directory first, then falls back to package directory"""

    def __init__(self, package_directory: Path, user_directory: Path, **kwargs):
        self.package_dir = package_directory
        self.user_dir = user_directory
        super().__init__(directory=str(package_directory), **kwargs)

    def lookup_path(self, path: str) -> tuple[str, os.stat_result | None]:
        # Check user directory first
        user_path = self.user_dir / path
        if user_path.is_file():
            return str(user_path), os.stat(user_path)
        # Fallback to package directory
        return super().lookup_path(path)


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


# User routers (optional custom router)
try:
    from routers import custom

    if hasattr(custom, "router"):
        app.include_router(custom.router)
        logger.info("Registered custom user router")
except ModuleNotFoundError:
    logger.debug("No custom router found (routers/custom.py)")
except Exception:
    logger.exception("Failed to load custom router from routers/custom.py")


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
    if not settings.add_security_headers and settings.environment == "dev":
        # Prevent caching in dev even if security headers are switched off
        response.headers["Cache-Control"] = "no-store, max-age=0"
    if settings.add_security_headers:
        data = read_security_headers()

        # Extract file extension from request URL
        file_ext = request.url.path.split(".")[-1].lower()
        image_ext = ("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg")

        for header in data["headers"]:
            # Excel on Windows doesn't display the icons in the ribbon otherwise
            if header["name"] == "Cache-Control" and file_ext in image_ext:
                continue
            if header["name"] not in (
                "Permissions-Policy",  # experimental
                "Clear-Site-Data",  # too aggressive
                "Content-Security-Policy",  # provide via XLWINGS_CUSTOM_HEADERS
            ):
                # Permissions-Policy headers are experimental
                # Clear-Site-Data is too aggressive
                response.headers[header["name"]] = header["value"]

        if settings.enable_excel_online:
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            del response.headers["X-Frame-Options"]
        if settings.cdn_officejs:
            response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
            del response.headers["Cross-Origin-Embedder-Policy"]

    # Custom headers
    for header_name, header_value in settings.custom_headers.items():
        response.headers[header_name] = header_value

    return response


# Static files: in prod might be served by something like nginx or via
# https://github.com/matthiask/blacknoise or https://github.com/Archmonger/ServeStatic
app.mount(
    settings.static_url_path,
    OverridableStaticFiles(
        package_directory=PACKAGE_DIR / "static", user_directory=PROJECT_DIR / "static"
    ),
    name="static",
)


if settings.enable_wasm:
    # For xlwings Wasm development
    app.mount(
        # Use the same path prefix as for static files
        settings.static_url_path.replace("static", "wasm"),
        OverridableStaticFiles(
            package_directory=PACKAGE_DIR / "wasm", user_directory=PROJECT_DIR / "wasm"
        ),
        name="wasm",
    )

    app.mount(
        # Use the same path prefix as for static files
        settings.static_url_path.replace("static", "custom_functions"),
        OverridableStaticFiles(
            package_directory=PACKAGE_DIR / "custom_functions",
            user_directory=PROJECT_DIR / "custom_functions",
        ),
        name="custom_functions",
    )

    app.mount(
        # Use the same path prefix as for static files
        settings.static_url_path.replace("static", "custom_scripts"),
        OverridableStaticFiles(
            package_directory=PACKAGE_DIR / "custom_scripts",
            user_directory=PROJECT_DIR / "custom_scripts",
        ),
        name="custom_scripts",
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
        msg = "An error occurred."
    return PlainTextResponse(msg, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
