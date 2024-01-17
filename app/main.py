import logging

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import settings
from .routers import macros, taskpane, xlwings_router

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# App
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# Routers
app.include_router(xlwings_router.router)
app.include_router(macros.router)
app.include_router(taskpane.router)


# Endpoints
@app.get("/")
async def root():
    # This endpoint could be used for a health check
    return {"status": "ok"}


# Static files: in prod should be served via a HTTP server like nginx if possible
app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")
StaticFiles.is_not_modified = lambda *args, **kwargs: False  # Never cache static files


# Exception handlers
@app.exception_handler(Exception)
async def exception_handler(request, exception):
    # This handles all exceptions, so you may want to make this more restrictive
    return PlainTextResponse(
        str(exception), status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


# CORS: Office Scripts and custom functions in Excel on the web require CORS
# Using app.add_middleware won't add the CORS headers if you handle the root "Exception"
# in an exception handler (it would require a specific exception type). Note that
# cors_app is used in the uvicorn.run() call.
cors_app = CORSMiddleware(
    app=app,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["POST"],
    allow_headers=["*"],
)
