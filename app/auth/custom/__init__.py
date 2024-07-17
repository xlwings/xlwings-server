import logging

from ... import models
from ...caching import cached

logger = logging.getLogger(__name__)


@cached(ttl=60 * 60, alias="default")
async def validate_token(token_string: str):
    return models.User(id="customid", name="custom user")
