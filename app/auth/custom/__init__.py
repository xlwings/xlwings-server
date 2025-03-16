import logging

from aiocache import cached

from ... import models

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60)
async def validate_token(token_string: str):
    """token_string has to be delivered via the Authorization header from Excel. The
    Authorization header is set by implementing the globalThis.getAuth() function
    under app/static/js/auth.js.
    See https://server.xlwings.org/en/latest/auth_providers/#custom-authentication
    """
    return models.User(id="customid", name="custom user")
