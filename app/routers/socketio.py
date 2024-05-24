import logging

import socketio
import xlwings as xw

from .. import custom_functions
from ..auth.entraid import validate_token
from ..config import settings

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=(
        settings.cors_allow_origins[0]
        if len(settings.cors_allow_origins) == 1
        else settings.cors_allow_origins
    ),
)


@sio.on("connect")
async def connect(sid, environ, auth):
    if settings.environment == "dev":
        from .. import hotreload

        logging.getLogger("watchfiles").setLevel(logging.ERROR)
        await hotreload.start_browser_reload_watcher(
            sio=sio, directory=settings.base_dir
        )
    await xw.server.sio_connect(sid, environ, auth, sio, authenticate=validate_token)


@sio.on("disconnect")
async def disconnect(sid):
    await xw.server.sio_disconnect(sid)


@sio.on("xlwings:function-call")
async def sio_function_call(sid, data):
    await xw.server.sio_custom_function_call(sid, data, custom_functions, sio)
