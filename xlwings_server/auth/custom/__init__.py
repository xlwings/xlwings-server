import logging
import secrets

from aiocache import cached
from fastapi import status
from fastapi.exceptions import HTTPException

from xlwings_server.models import User

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60)
async def validate_token(token_string: str):
    """token_string has to be delivered via the Authorization header from Excel. The
    Authorization header is set by implementing the globalThis.getAuth() function
    under static/js/auth.js.
    See https://server.xlwings.org/en/latest/auth_providers/#custom-authentication
    """
    if secrets.compare_digest(token_string, "test-token"):  # TODO: implement
        return User(id="customid", name="custom user")
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Custom Auth Error: Couldn't validate token",
        )
