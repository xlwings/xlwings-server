import logging

import socketio
from fastapi import FastAPI, status
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import settings
from .routers import macros, socketio_router, taskpane, xlwings_router

# Logging
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

# App
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# CORS: Office Scripts and custom functions in Excel on the web require CORS
# Using app.add_middleware won't add the CORS headers if you handle the root "Exception"
# in an exception handler (it would require a specific exception type).
cors_app = CORSMiddleware(
    app=app,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Routers
app.include_router(xlwings_router.router)
app.include_router(macros.router)
app.include_router(taskpane.router)

# Socket.io
sio_app = socketio.ASGIApp(socketio_router.sio, cors_app)


# Endpoints
@app.get("/")
async def root():
    # This endpoint could be used for a health check
    return {"status": "ok"}


# Static files: in prod should be served via a HTTP server like nginx if possible
app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")
StaticFiles.is_not_modified = lambda *args, **kwargs: False  # Never cache static files


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exception):
    logger.error(exception)
    return PlainTextResponse(
        exception.detail, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


@app.exception_handler(Exception)
async def exception_handler(request, exception):
    # This handles all exceptions, so you may want to make this more restrictive
    logger.error(exception)
    return PlainTextResponse(
        str(exception), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
