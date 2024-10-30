import logging

from fastapi import APIRouter

from ..config import settings

router = APIRouter(prefix=settings.app_path)

logger = logging.getLogger(__name__)


# Endpoints
@router.get("/")
async def root():
    # This endpoint could be used for a health check
    return {"status": "ok"}
