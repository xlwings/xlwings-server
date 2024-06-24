import logging

from aiocache import Cache, cached

from ..models import User

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60, cache=Cache.MEMORY)
async def validate_token(token_string: str):
    return User(id="id-xx", name="user-name")
