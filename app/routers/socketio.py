import logging

import socketio
import xlwings as xw

from .. import custom_functions
from ..config import settings
from ..dependencies import authenticate
from ..models import CurrentUser

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
        from .. import hotreload

        logging.getLogger("watchfiles").setLevel(logging.ERROR)
        await hotreload.start_browser_reload_watcher(
            sio=sio, directory=settings.base_dir
        )
    token_string = auth.get("token")
    try:
        current_user = await authenticate(token_string)
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
    session = await sio.get_session(sid)
    current_user = session["current_user"]
    logger.info(f"""Function "{data['func_name']}" called by {sid}""")
    await xw.server.sio_custom_function_call(
        sid, data, custom_functions, current_user, sio, {CurrentUser: current_user}
    )
