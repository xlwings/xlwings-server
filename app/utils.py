from .routers import socketio as socketio_router


async def trigger_script(script, **options):
    if not isinstance(script, str):
        script = script.__name__
    await socketio_router.sio.emit(
        "xlwings:trigger-script",
        {"script_name": script, "config": options},
    )
