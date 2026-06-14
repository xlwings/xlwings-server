import asyncio
import logging

import socketio
import xlwings as xw

# Try to import custom modules from project directory first (CLI/Azure mode)
# Fall back to package location (tests/package mode)
try:
    import custom_functions
except ModuleNotFoundError:
    import xlwings_server.custom_functions as custom_functions

from xlwings_server.config import PROJECT_DIR, settings
from xlwings_server.dependencies import authenticate
from xlwings_server.models import CurrentUser

logger = logging.getLogger(__name__)

if settings.socketio_message_queue_url:
    client_manager = socketio.AsyncRedisManager(
        settings.socketio_message_queue_url, write_only=not settings.socketio_server_app
    )
else:
    client_manager = None


sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=client_manager,
    cors_allowed_origins=(
        settings.cors_allow_origins[0]
        if len(settings.cors_allow_origins) == 1
        else settings.cors_allow_origins
    ),
)


@sio.on("connect")
async def connect(sid, environ, auth):
    if settings.environment == "dev" and settings.enable_hotreload:
        from xlwings_server import hotreload

        logging.getLogger("watchfiles").setLevel(logging.ERROR)
        await hotreload.start_browser_reload_watcher(sio=sio, directory=PROJECT_DIR)
    auth = auth if isinstance(auth, dict) else {}
    token_string = auth.get("token")
    provider = auth.get("provider")
    try:
        current_user = await authenticate(token_string, auth_provider=provider)
        await sio.save_session(sid, {"current_user": current_user})
        logger.info(f"Socket.io: connect {sid}")
        logger.info(f"Socket.io: User authenticated {current_user.name}")
    except Exception as e:
        logger.info(f"Socket.io: authentication failed for sid {sid}: {repr(e)}")
        await sio.disconnect(sid)


@sio.on("disconnect")
async def disconnect(sid):
    await xw.server.sio_disconnect(sid)


@sio.on("xlwings:function-call")
async def sio_function_call(sid, data):
    if not isinstance(data, dict) or "func_name" not in data or "task_key" not in data:
        logger.warning(f"Socket.io: malformed function-call payload from sid {sid}")
        return
    session = await sio.get_session(sid)
    current_user = session.get("current_user")
    if current_user is None:
        logger.warning(f"Socket.io: no authenticated user for sid {sid}, disconnecting")
        await sio.disconnect(sid)
        return
    logger.info(
        f"""Streaming function "{data['func_name']}" called by {current_user.name}"""
    )
    await xw.server.sio_custom_function_call(
        sid, data, custom_functions, current_user, sio, {CurrentUser: current_user}
    )
    active_count = sum(
        1 for t in asyncio.all_tasks() if t.get_name().startswith("xlwings-")
    )
    logger.info(f"Active streaming tasks: {active_count}")


@sio.on("xlwings:cancel-task")
async def sio_cancel_task(sid, data):
    session = await sio.get_session(sid)
    if session.get("current_user") is None:
        await sio.disconnect(sid)
        return
    task_key = data.get("task_key") if isinstance(data, dict) else None
    if isinstance(task_key, str) and task_key:
        await xw.server.sio_cancel_task(sid, task_key)
        await asyncio.sleep(0)  # let event loop finalize cancellation
        active_count = sum(
            1 for t in asyncio.all_tasks() if t.get_name().startswith("xlwings-")
        )
        logger.info(f"Active streaming tasks: {active_count}")
