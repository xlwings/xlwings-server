import logging

from aiocache import cached

from xlwings_server.models import User

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60)
async def validate_token(token_string: str):
    """token_string has to be delivered via the Authorization header from Excel. The
    Authorization header is set by implementing the globalThis.getAuth() function
    under static/js/auth.js.
    See https://server.xlwings.org/en/latest/auth_providers/#custom-authentication
    """
    return User(id="customid", name="custom user")
