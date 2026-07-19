import importlib.util
import logging
import os
import sys
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
from xlwings_server.object_handles import (
    CONVERTER_KEYS as OBJECT_CONVERTER_KEYS,
    ObjectCacheConverter,
    XlwingsOperationalError,
)
from xlwings_server.routers import socketio as socketio_router
from xlwings_server.routers.manifest import router as manifest_router
from xlwings_server.routers.root import router as root_router
from xlwings_server.routers.taskpane import router as taskpane_router
from xlwings_server.routers.xlwings import router as xlwings_router
from xlwings_server.security_headers import resolve_security_headers
from xlwings_server.templates import templates

# Logging
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

logger.info(f"Running in '{'Wasm' if settings.enable_wasm else 'Server'}' mode.")

# User lifespan hook (optional). Load PROJECT_DIR/lifespan.py by its exact path
# rather than `import lifespan` / find_spec("lifespan"): a bare import searches
# all of sys.path and could bind to an unrelated installed module that happens
# to be named `lifespan`. If the file is absent, this is a silent no-op. If it
# is present but fails to import or exposes no `lifespan`, we re-raise/raise so
# the server fails fast -- silently starting without the user's startup code
# (e.g. a database pool or cache warm-up) would be worse than not starting.
user_lifespan = None
_lifespan_file = PROJECT_DIR / "lifespan.py"
if _lifespan_file.is_file():
    # Canonical registration is under a private name so we never shadow a real
    # third-party package named `lifespan`, and so __module__ resolution,
    # decorators, and dataclasses in the user's file all see one stable module.
    _lifespan_mod_name = "_xlwings_server_user_lifespan"
    _lifespan_spec = importlib.util.spec_from_file_location(
        _lifespan_mod_name, _lifespan_file
    )
    _user_lifespan_module = importlib.util.module_from_spec(_lifespan_spec)
    sys.modules[_lifespan_mod_name] = _user_lifespan_module
    # Additionally alias the bare `lifespan` name while executing the file so
    # an import-time self-referential `import lifespan` resolves to this same
    # instance. Only add the alias when that name is free, and always remove it
    # afterward so a third-party `lifespan` package imported later is not
    # shadowed by the user hook.
    _alias_lifespan = "lifespan" not in sys.modules
    if _alias_lifespan:
        sys.modules["lifespan"] = _user_lifespan_module

    def _cleanup_lifespan_alias():
        if _alias_lifespan and sys.modules.get("lifespan") is _user_lifespan_module:
            sys.modules.pop("lifespan", None)

    def _cleanup_lifespan_module():
        if sys.modules.get(_lifespan_mod_name) is _user_lifespan_module:
            sys.modules.pop(_lifespan_mod_name, None)

    try:
        _lifespan_spec.loader.exec_module(_user_lifespan_module)
    except Exception:
        _cleanup_lifespan_alias()
        _cleanup_lifespan_module()
        logger.exception("Failed to load lifespan hook from lifespan.py")
        raise
    _cleanup_lifespan_alias()
    if not hasattr(_user_lifespan_module, "lifespan"):
        _cleanup_lifespan_module()
        raise RuntimeError(
            f"{_lifespan_file} exists but exposes no `lifespan` context manager"
        )
    user_lifespan = _user_lifespan_module.lifespan
    logger.info("Registered custom lifespan hook")
else:
    logger.debug("No custom lifespan found (lifespan.py)")

# App
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=user_lifespan)


# Starlette's url_for returns fully qualified URLs causing issues if the reverse proxy
# handles TLS and the app runs on http (https://github.com/encode/starlette/issues/843)
def url_for(name: str, **path_params):
    """Wrapper around url_path_for that strips leading slashes from path parameters"""
    if name == "static" and "path" in path_params:
        # Strip leading slash from static file paths to avoid double slashes
        path_params["path"] = path_params["path"].lstrip("/")
    return app.url_path_for(name, **path_params)


templates.env.globals["url_for"] = url_for

# Register Converter under the keys that custom_functions_call also uses to identify
# handle-producing functions
ObjectCacheConverter.register(*OBJECT_CONVERTER_KEYS)


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
# Probe for the submodule first so we only enter the import when the file
# actually exists. find_spec raises ModuleNotFoundError when EITHER the parent
# `routers` package is absent (the normal case -- e.g. tests, or a project with
# no routers/ dir) or the `custom` submodule is missing; both mean "no custom
# router", so we swallow it. (A bare `from routers import custom` would instead
# raise a plain ImportError -- "cannot import name 'custom'" -- when routers
# exists but custom.py doesn't, which is easy to mis-handle.) The inner except
# stays scoped to *real* failures inside an existing custom.py.
try:
    custom_spec = importlib.util.find_spec("routers.custom")
except ModuleNotFoundError:
    custom_spec = None

if custom_spec is not None:
    try:
        from routers import custom

        if hasattr(custom, "router"):
            app.include_router(custom.router)
            logger.info("Registered custom user router")
    except Exception:
        logger.exception("Failed to load custom router from routers/custom.py")
else:
    logger.debug("No custom router found (routers/custom.py)")


# Security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    # See xlwings_server/security_headers.py for the header values and sources.
    response = await call_next(request)
    if not settings.add_security_headers and settings.environment == "dev":
        # Prevent caching in dev even if security headers are switched off
        response.headers["Cache-Control"] = "no-store, max-age=0"
    if settings.add_security_headers:
        headers = resolve_security_headers(
            excel_online=settings.enable_excel_online,
            cdn_officejs=settings.cdn_officejs,
        )

        # Extract file extension from request URL
        file_ext = request.url.path.split(".")[-1].lower()
        image_ext = ("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg")

        for name, value in headers.items():
            # Excel on Windows doesn't display the icons in the ribbon otherwise
            if name == "Cache-Control" and file_ext in image_ext:
                continue
            response.headers[name] = value

    # Custom headers
    for header_name, header_value in settings.custom_headers.items():
        response.headers[header_name] = header_value

    return response


# Static files: in prod might be served by something like nginx or via
# https://github.com/matthiask/blacknoise or https://github.com/Archmonger/ServeStatic
# Auto-detect dist/ directory for production builds with hashed filenames
dist_static = PROJECT_DIR / "dist" / "static"
if dist_static.exists() and settings.environment != "dev":
    app.mount(
        settings.static_url_path,
        StaticFiles(directory=dist_static),
        name="static",
    )
    logger.info("Serving static files from dist/ (production build)")
else:
    app.mount(
        settings.static_url_path,
        OverridableStaticFiles(
            package_directory=PACKAGE_DIR / "static",
            user_directory=PROJECT_DIR / "static",
        ),
        name="static",
    )


if settings.enable_wasm:
    # For xlwings Wasm development
    app.mount(
        # Use the same path prefix as for static files
        settings.static_url_path.replace("static", "wasm"),
        OverridableStaticFiles(
            package_directory=PACKAGE_DIR / "wasm",
            user_directory=PROJECT_DIR / "wasm",
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
@app.exception_handler(XlwingsOperationalError)
async def xlwings_operational_exception_handler(request, exception):
    # 503, not 400: a transient/operational failure (e.g. the cache backend is
    # unreachable). A 5xx status lets custom functions retry it (see
    # custom_functions_retry_codes), unlike the deterministic errors handled below.
    logger.error(exception)
    return PlainTextResponse(
        str(exception), status_code=status.HTTP_503_SERVICE_UNAVAILABLE
    )


@app.exception_handler(XlwingsError)
async def xlwings_exception_handler(request, exception):
    logger.error(exception)
    msg = str(exception)
    # 400, not 500: an XlwingsError is a deliberate, deterministic error (bad argument,
    # missing role, not an object handle, ...), not a transient server fault. Returning a
    # non-5xx status keeps custom functions from retrying it (see custom_functions_retry_codes).
    return PlainTextResponse(msg, status_code=status.HTTP_400_BAD_REQUEST)


@app.exception_handler(Exception)
async def exception_handler(request, exception):
    logger.error(exception)
    if settings.environment == "dev":
        msg = repr(exception)
    else:
        msg = "An error occurred."
    return PlainTextResponse(msg, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
