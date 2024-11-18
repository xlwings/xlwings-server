"""
TODO:
- move wasm call from init to runPython
- automatic pyscript.json config?
- static page CLI build command (code, meta, custom-scripts-sheet-buttons, etc.)
- include enable_wasm in .env file
- create xlwings.conf file in .env format for wasm runtime to set license key (python-dotenv)
- run 10000 custom functions (also on Windows)
- Check out https://docs.pyscript.net/2024.5.2/user-guide/workers/

xlwings Limitations:
- missing object handles
- missing alert
- only task pane buttons handle errors

PyScript Limitations:
- You can use pyscript.fetch, but often, you'll run into CORS issues (GitHub is fine though)
- No support for TCP/IP connections, i.e., no connections with external databases like Postgres
- No access to local file system, but there's a virtual file system where files can be created via URLs or via upload
"""

import os
import traceback

os.environ["XLWINGS_LICENSE_KEY"] = "noncommercial"
import platform

import custom_functions
import custom_scripts
import pyodide_js  # type: ignore
import xlwings as xw
from pyscript import ffi, window  # type: ignore
from xlwings.server import (
    custom_functions_call as xlwings_custom_functions_call,
    custom_scripts_call as xlwings_custom_scripts_call,
)

# Print Python and Pyodide versions
print(f"Python version: {platform.python_version()}")
print(f"Pyodide version: {pyodide_js.version}")


async def custom_functions_call(data):
    data = data.to_py()
    try:
        rv = await xlwings_custom_functions_call(
            data,
            module=custom_functions,
        )
    except Exception as e:
        return {"error": str(e), "details": traceback.format_exc()}
    return ffi.to_js(rv)


window.custom_functions_call = custom_functions_call


async def custom_scripts_call(data, script_name):
    book = xw.Book(json=data.to_py())
    try:
        book = await xlwings_custom_scripts_call(
            module=custom_scripts,
            script_name=script_name,
            typehint_to_value={xw.Book: book},
        )
    except Exception as e:
        return {"error": str(e), "details": traceback.format_exc()}
    # Note: converts None to undefined
    return ffi.to_js(book.json())


window.custom_scripts_call = custom_scripts_call
