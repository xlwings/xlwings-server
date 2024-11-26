import config  # noqa: F401, I001 Must be first import to load env vars
import platform
import traceback

try:
    # Via xlwings Server
    from .. import custom_functions, custom_scripts
except ImportError:
    # Via PyScript
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
print(f"xlwings version: {xw.__version__}")


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
