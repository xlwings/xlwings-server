import logging

from xlwings.pro import object_handles as core_object_handles

from . import object_handles  # noqa: F401  Ensures the configured store is installed
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
    # Clears whichever store is active (Redis or the in-memory LRU). The store lives on
    # the core module, where xlwings_server.object_handles installed the configured one.
    core_object_handles.cache.clear()
    logger.info("Cleared the object cache")
