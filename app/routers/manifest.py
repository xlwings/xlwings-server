import logging
import os

from fastapi import APIRouter, Request

from ..config import settings
from ..templates import TemplateResponse

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/manifest")
async def manifest(request: Request):
    if settings.hostname:
        # Settings
        if settings.hostname.startswith("https://"):
            hostname = settings.hostname[8:]
        else:
            hostname = settings.hostname
        base_url = f"https://{hostname}"
    elif os.getenv("RENDER_EXTERNAL_URL"):
        # Render
        base_url = os.getenv("RENDER_EXTERNAL_URL")
    elif os.getenv("WEBSITE_HOSTNAME"):
        # Azure Functions
        base_url = os.getenv("WEBSITE_HOSTNAME")
    else:
        # Mostly localhost
        base_url = request.base_url

    return TemplateResponse(
        request=request,
        name="/manifest.xml",
        context={"settings": settings, "base_url": str(base_url).rstrip("/")},
        media_type="text/plain",
    )
