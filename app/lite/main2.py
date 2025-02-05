import config
import custom_functions
import js  # type: ignore
import xlwings as xw
from pyodide.ffi import to_js  # type: ignore

print(dir(custom_functions))

print(f"xlwings version: {xw.__version__}")
print(type(config.settings))


def hello():
    return to_js(
        {"some": ["key", 1.2, True, None]}, dict_converter=js.Object.fromEntries
    )
