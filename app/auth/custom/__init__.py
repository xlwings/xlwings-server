import logging

from aiocache import Cache, cached

from ... import models

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60, cache=Cache.MEMORY)
async def validate_token(token_string: str):
    return models.User(id="customid", name="custom user")
