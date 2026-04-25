from config import settings  # noqa: F401, I001 Must be first import to load env vars
import traceback
import importlib.util
import sys
import inspect
from textwrap import dedent

import custom_functions
import custom_scripts
import js  # type: ignore
import xlwings as xw
import xlwings.server
from pyodide.ffi import to_js  # type: ignore

try:
    import matplotlib as mpl

    mpl.use("agg")
except ImportError:
    mpl = None


# xlwings <0.33.13 doesn't have custom_scripts_meta
if not hasattr(xlwings.server, "custom_scripts_meta"):
    xlwings.server.custom_scripts_meta = lambda module: []


def create_module_from_string(module_string, module_name):
    spec = importlib.util.spec_from_loader(
        module_name,
        loader=None,
    )
    module = importlib.util.module_from_spec(spec)
    exec(module_string, module.__dict__)
    sys.modules[module_name] = module
    return module


async def custom_functions_call(data):
    data = data.to_py()
    try:
        result = await xlwings.server.custom_functions_call(
            data,
            module=custom_functions,
        )
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
    # Note: converts None to undefined
    return to_js(result, dict_converter=js.Object.fromEntries)


async def custom_scripts_call(data, script_name):
    book = xw.Book(json=data.to_py())
    try:
        book = await xlwings.server.custom_scripts_call(
            module=custom_scripts,
            script_name=script_name,
            typehint_to_value={xw.Book: book},
        )
        result = book.json()
        return to_js(result, dict_converter=js.Object.fromEntries)
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
        return to_js(result, dict_converter=js.Object.fromEntries)


def custom_scripts_meta():
    scripts_meta = xlwings.server.custom_scripts_meta(custom_scripts)
    return to_js(scripts_meta, dict_converter=js.Object.fromEntries)


def custom_functions_meta(module_string):
    try:
        module = create_module_from_string(module_string, "main")
    except Exception as e:  # noqa: E722
        js.console.log(f"Parsing error [custom_functions_meta]: {e}")
        return to_js({}, dict_converter=js.Object.fromEntries)
    return to_js(
        xlwings.server.custom_functions_meta(module),
        dict_converter=js.Object.fromEntries,
    )


def custom_functions_code(module_string):
    try:
        module = create_module_from_string(module_string, "main")
    except Exception as e:  # noqa: E722
        js.console.log(f"Parsing error [custom_functions_code]: {e}")
        return ""
    code = ""
    for _, obj in inspect.getmembers(module):
        if hasattr(obj, "__xlfunc__"):
            xlfunc = obj.__xlfunc__
            func_name = xlfunc["name"]
            streaming = "true" if inspect.isasyncgenfunction(obj) else "false"
            code += dedent(
                f"""\
            async function {func_name}() {{
                let args = ["{func_name}", {streaming}]
                args.push.apply(args, arguments);
                return await base.apply(null, args);
            }}
            CustomFunctions.associate("{func_name.upper()}", {func_name});
            """
            )
    return code
