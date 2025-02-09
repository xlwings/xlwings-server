import config  # noqa: F401, I001 Must be first import to load env vars
import platform
import traceback
import importlib.util
import sys
import contextlib
from io import StringIO
import ast
import inspect
from textwrap import dedent

try:
    # Via xlwings Server
    from .. import custom_functions, custom_scripts
except ImportError:
    # xlwings Lite
    import custom_functions  # noqa: F401
    import custom_scripts
import js  # type: ignore
import pyodide_js  # type: ignore
import xlwings as xw
from pyodide.ffi import to_js  # type: ignore
from xlwings.server import (
    custom_functions_call as xlwings_custom_functions_call,
    custom_functions_meta as xlwings_custom_functions_meta,
    custom_scripts_call as xlwings_custom_scripts_call,
)

try:
    import matplotlib as mpl

    mpl.use("agg")
except ImportError:
    mpl = None


class HtmlOutput:
    def __init__(self, div_id):
        self.div_id = div_id
        self.buffer = StringIO()

    def write(self, text):
        # Write to buffer and update div content
        self.buffer.write(text)
        content = self.buffer.getvalue()
        js.document.getElementById(self.div_id).innerHTML = f"<pre>{content}</pre>"

    def flush(self):
        pass


# Print Python and Pyodide versions
print(f"Python version: {platform.python_version()}")
print(f"Pyodide version: {pyodide_js.version}")
print(f"xlwings version: {xw.__version__}")


async def custom_functions_call(data, module_string=None):
    html_output = HtmlOutput("output")
    module_name = "main"  # TODO
    if module_string:
        spec = importlib.util.spec_from_loader(
            module_name,
            loader=None,
        )
        module = importlib.util.module_from_spec(spec)
        exec(module_string, module.__dict__)
        sys.modules[module_name] = module
    else:
        module = custom_scripts

    data = data.to_py()
    try:
        with (
            contextlib.redirect_stdout(html_output),
            contextlib.redirect_stderr(html_output),
        ):
            result = await xlwings_custom_functions_call(
                data,
                module=module,
            )
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
    # Note: converts None to undefined
    return to_js(result, dict_converter=js.Object.fromEntries)


async def custom_scripts_call(data, script_name, module_string=None):
    module_name = "main"  # TODO
    html_output = HtmlOutput("output")
    if module_string:
        spec = importlib.util.spec_from_loader(
            module_name,
            loader=None,
        )
        module = importlib.util.module_from_spec(spec)
        with (
            contextlib.redirect_stdout(html_output),
            contextlib.redirect_stderr(html_output),
        ):
            exec(module_string, module.__dict__)
        sys.modules[module_name] = module
    else:
        module = custom_scripts

    book = xw.Book(json=data.to_py())
    try:
        with (
            contextlib.redirect_stdout(html_output),
            contextlib.redirect_stderr(html_output),
        ):
            book = await xlwings_custom_scripts_call(
                module=module,
                script_name=script_name,
                typehint_to_value={xw.Book: book},
            )
        result = book.json()
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
    return to_js(result, dict_converter=js.Object.fromEntries)


def get_xlwings_scripts(code_string):
    try:
        tree = ast.parse(code_string)
    except:  # noqa: E722
        return to_js([])
    xlwings_functions = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            for decorator in node.decorator_list:
                decorator_str = ast.unparse(decorator)
                if "script" in decorator_str:
                    xlwings_functions.append(node.name)
                    break

    return to_js(xlwings_functions)


def custom_functions_meta(module_string):
    try:
        module_name = "main"
        spec = importlib.util.spec_from_loader(
            module_name,
            loader=None,
        )
        module = importlib.util.module_from_spec(spec)
        exec(module_string, module.__dict__)
        sys.modules[module_name] = module
    except:  # noqa: E722
        return to_js({}, dict_converter=js.Object.fromEntries)
    return to_js(
        xlwings_custom_functions_meta(module), dict_converter=js.Object.fromEntries
    )


def custom_functions_code(module_string):
    # TODO: factor out
    try:
        module_name = "main"
        spec = importlib.util.spec_from_loader(
            module_name,
            loader=None,
        )
        module = importlib.util.module_from_spec(spec)
        exec(module_string, module.__dict__)
        sys.modules[module_name] = module
    except:  # noqa: E722
        return ""
    js = ""
    for name, obj in inspect.getmembers(module):
        if hasattr(obj, "__xlfunc__"):
            xlfunc = obj.__xlfunc__
            func_name = xlfunc["name"]
            streaming = "true" if inspect.isasyncgenfunction(obj) else "false"
            js += dedent(
                f"""\
            async function {func_name}() {{
                let args = ["{func_name}", {streaming}]
                args.push.apply(args, arguments);
                return await base.apply(null, args);
            }}
            CustomFunctions.associate("{func_name.upper()}", {func_name});
            """
            )
    return js
