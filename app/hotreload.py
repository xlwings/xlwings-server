"""
Uvicorn reloads the app when the Python code is changed. So, we need to reload the
browser when the app starts to show any changes caused the Python code.
But, restarting the app takes a lot of time (especially in Docker), so we
watch HTML, CSS, and JS files separately via Watchfiles. If these files change, we just
reload the browser without having to restart the Python app.
"""

from pathlib import Path

from watchfiles import Change, DefaultFilter, awatch

from .config import settings

browser_reload_triggered_by_backend = False
watching_frontend_files = False


class WebFilter(DefaultFilter):
    allowed_extensions = (".html", ".css", ".js", ".py", ".txt", ".env")

    def __call__(self, change: Change, path: str) -> bool:
        if not super().__call__(change, path):
            return False

        path = Path(path)
        if path.suffix not in self.allowed_extensions:
            return False

        # Allow HTML/CSS/JS files anywhere
        if path.suffix in (".html", ".css", ".js"):
            return True

        # xlwings Lite
        if settings.enable_lite and path.suffix in (".py", ".txt", ".env"):
            allowed_dirs = ("lite", "custom_scripts", "custom_functions")
            return any(dir_name in path.parts for dir_name in allowed_dirs)

        return False


async def watch_frontend_files(sio, directory):
    async for changes in awatch(
        directory,
        watch_filter=WebFilter(),
    ):
        await sio.emit("reload")


async def start_browser_reload_watcher(sio, directory):
    """Needs to be called from the sio connect event on the backend"""
    global browser_reload_triggered_by_backend
    global watching_frontend_files
    if not browser_reload_triggered_by_backend and not settings.enable_lite:
        await sio.emit("reload")
        browser_reload_triggered_by_backend = True
    if not watching_frontend_files:
        sio.start_background_task(watch_frontend_files, sio=sio, directory=directory)
        watching_frontend_files = True
