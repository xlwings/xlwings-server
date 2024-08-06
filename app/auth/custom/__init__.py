import logging

from aiocache import cached

from ... import models

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60)
async def validate_token(token_string: str):
    return models.User(id="customid", name="custom user")
