import datetime as dt
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


_call_count = 0


@router.get("/check-version")
async def check_version():
    """Endpoint to check for the latest Account model version"""
    global _call_count
    _call_count += 1

    # Return different versions for testing
    if _call_count < 5:
        latest_version = "1.2.3"
    else:
        latest_version = "1.2.4"

    return {"version": latest_version, "timestamp": dt.datetime.now().isoformat()}
