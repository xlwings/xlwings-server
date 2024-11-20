"""
TODO:
- integrate make_static.py into CLI
- static page CLI build command (code, meta, custom-scripts-sheet-buttons, etc.)
- config for switching between CDN and local wasm
- include enable_wasm in .env file
- run 10000 custom functions (also on Windows)
- allow WASM to coexist with Python backend instead of either or
- Check out https://docs.pyscript.net/2024.5.2/user-guide/workers/
- release xlwings package

xlwings Limitations:
- missing object handles (depend on settings, serializers, and redis expiry)
- missing alert (depends on Jinja template)
- only task pane buttons handle errors (depends on alert)
- streaming functions (depend on socket.io)

PyScript Limitations:
- You can use pyscript.fetch, but often, you'll run into CORS issues (GitHub is fine though)
- No support for TCP/IP connections, i.e., no connections with external databases like Postgres
- No access to local file system, but there's a virtual file system where files can be created via URLs or via upload
"""

# Settings
import config  # noqa: F401, I001 Must be first import to load env vars
import platform
import traceback

import custom_functions
import custom_scripts
import pyodide_js  # type: ignore
import xlwings as xw
from pyscript import ffi, window  # type: ignore
from xlwings.server import (
    custom_functions_call as xlwings_custom_functions_call,
    custom_scripts_call as xlwings_custom_scripts_call,
)

try:
    import matplotlib as mpl

    mpl.use("agg")
except ImportError:
    mpl = None

# Print Python and Pyodide versions
print(f"Python version: {platform.python_version()}")
print(f"Pyodide version: {pyodide_js.version}")


async def custom_functions_call(data):
    data = data.to_py()
    try:
        result = await xlwings_custom_functions_call(
            data,
            module=custom_functions,
        )
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
    # Note: converts None to undefined
    return ffi.to_js(result)


window.custom_functions_call = custom_functions_call


async def custom_scripts_call(data, script_name):
    book = xw.Book(json=data.to_py())
    try:
        book = await xlwings_custom_scripts_call(
            module=custom_scripts,
            script_name=script_name,
            typehint_to_value={xw.Book: book},
        )
        result = book.json()
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
    return ffi.to_js(result)


window.custom_scripts_call = custom_scripts_call
