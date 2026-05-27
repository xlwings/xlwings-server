import logging

from fastapi import APIRouter
from fastapi.responses import FileResponse

from ..config import PACKAGE_DIR, PROJECT_DIR, settings

router = APIRouter(prefix=settings.app_path)

logger = logging.getLogger(__name__)


# Endpoints (@get doesn't automatically support HEAD)
@router.api_route("/", methods=["GET", "HEAD"])
async def root():
    # This endpoint could be used for a health check
    return {"status": "ok"}


@router.get("/favicon.ico")
async def favicon():
    user_favicon = PROJECT_DIR / "static" / "images" / "favicon.png"
    favicon_path = (
        user_favicon
        if user_favicon.is_file()
        else PACKAGE_DIR / "static" / "images" / "favicon.png"
    )
    return FileResponse(favicon_path, media_type="image/png")
