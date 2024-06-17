from .routers import socketio as socketio_router


async def trigger_script(script_name, **options):
    await socketio_router.sio.emit(
        "xlwings:trigger-script",
        {"script_name": script_name, "config": options},
    )
