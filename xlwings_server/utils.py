import logging

import redis

from . import object_handles
from .config import settings
from .routers import socketio as socketio_router, xlwings as xlwings_router

logger = logging.getLogger(__name__)


async def trigger_script(script, **options):
    sid = xlwings_router.socketio_id_context.get()
    if not isinstance(script, str):
        script = script.__name__
    await socketio_router.sio.emit(
        "xlwings:trigger-script",
        {"script_name": script, **options},
        to=sid,
    )
    logger.info(f"Script '{script}' triggered for sid '{sid}' with config: {options}")


async def clear_object_cache():
    if settings.object_cache_url:
        redis_client: redis.Redis = xlwings_router.redis_client_context.get()
        keys = redis_client.scan_iter(match="object:*")
        for key in keys:
            redis_client.delete(key)
        logger.info("Cleared all keys starting with 'object:' from the Redis cache")
    else:
        object_handles.cache = {}
