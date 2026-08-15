import logging

from xlwings.pro import object_handles as core_object_handles

from . import object_handles  # noqa: F401  Ensures the configured store is installed

logger = logging.getLogger(__name__)


async def clear_object_cache():
    # Clears whichever store is active (Redis or the in-memory LRU). The store lives on
    # the core module, where xlwings_server.object_handles installed the configured one.
    core_object_handles.cache.clear()
    logger.info("Cleared the object cache")
