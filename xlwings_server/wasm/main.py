from config import settings  # noqa: F401, I001 Must be first import to load env vars
import platform
import traceback
import importlib.util
import sys
import contextlib
from io import StringIO
import ast
import inspect
from textwrap import dedent

import custom_functions
import custom_scripts
import js  # type: ignore
import pyodide_js  # type: ignore
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


class HtmlOutput:
    def __init__(self, div_id):
        self.div_id = div_id
        self.buffer = StringIO()

    def write(self, text):
        self.buffer.write(text)
        content = self.buffer.getvalue()
        div = js.document.getElementById(self.div_id)
        if div:
            js.document.getElementById(self.div_id).innerHTML = f"<pre>{content}</pre>"
            # Scroll to bottom
            outputContainer = js.document.querySelector("#output-container")
            if outputContainer:
                outputContainer.scrollTop = outputContainer.scrollHeight

    def flush(self):
        pass


if settings.is_official_lite_addin:
    html_output = HtmlOutput("output")
    try:
        import pyodide_http  # type: ignore
    except ImportError:
        pyodide_http = None
    if pyodide_http:
        pyodide_http.patch_all()  # Fixes pd.read_csv()


# Print Python and Pyodide versions
def print_versions():
    if settings.is_official_lite_addin:
        html_output = HtmlOutput("output")
        with (
            contextlib.redirect_stdout(html_output),
            contextlib.redirect_stderr(html_output),
        ):
            print(
                f"Python {platform.python_version()}|Pyodide {pyodide_js.version}|xlwings {xw.__version__}"
            )


def create_module_from_string(module_string, module_name, html_output=None):
    spec = importlib.util.spec_from_loader(
        module_name,
        loader=None,
    )
    module = importlib.util.module_from_spec(spec)
    if html_output:
        with (
            contextlib.redirect_stdout(html_output),
            contextlib.redirect_stderr(html_output),
        ):
            exec(module_string, module.__dict__)
    else:
        exec(module_string, module.__dict__)
    sys.modules[module_name] = module
    return module


async def custom_functions_call(data):
    if settings.is_official_lite_addin:
        import main_editor

        module = main_editor
    else:
        module = custom_functions

    data = data.to_py()
    try:
        if settings.is_official_lite_addin:
            with (
                contextlib.redirect_stdout(html_output),
                contextlib.redirect_stderr(html_output),
            ):
                result = await xlwings.server.custom_functions_call(
                    data,
                    module=module,
                )
        else:
            result = await xlwings.server.custom_functions_call(
                data,
                module=module,
            )
    except Exception as e:
        result = {"error": str(e), "details": traceback.format_exc()}
    # Note: converts None to undefined
    return to_js(result, dict_converter=js.Object.fromEntries)


async def custom_scripts_call(data, script_name):
    if settings.is_official_lite_addin:
        import main_editor

        module = main_editor
    else:
        module = custom_scripts

    book = xw.Book(json=data.to_py())
    try:
        if settings.is_official_lite_addin:
            with (
                contextlib.redirect_stdout(html_output),
                contextlib.redirect_stderr(html_output),
            ):
                book = await xlwings.server.custom_scripts_call(
                    module=module,
                    script_name=script_name,
                    typehint_to_value={xw.Book: book},
                )
        else:
            book = await xlwings.server.custom_scripts_call(
                module=module,
                script_name=script_name,
                typehint_to_value={xw.Book: book},
            )
        result = book.json()
        return to_js(result, dict_converter=js.Object.fromEntries)
    except Exception as e:
        error_traceback = traceback.format_exc()
        if settings.is_official_lite_addin:
            error_output = HtmlOutput(
                "output"
            )  # Clear output before writing out an error
            error_output.write(f'<span style="color: red">{error_traceback}</span>')
            return to_js({"actions": []}, dict_converter=js.Object.fromEntries)
        else:
            result = {"error": str(e), "details": error_traceback}
            return to_js(result, dict_converter=js.Object.fromEntries)


def custom_scripts_meta():
    if settings.is_official_lite_addin:
        import main_editor

        module = main_editor
    else:
        module = custom_scripts
    scripts_meta = xlwings.server.custom_scripts_meta(module)
    return to_js(scripts_meta, dict_converter=js.Object.fromEntries)


def get_xlwings_scripts(code_string, script_button_text):
    try:
        tree = ast.parse(code_string)
    except:  # noqa: E722
        return to_js([script_button_text])
    xlwings_functions = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                decorator_str = ast.unparse(decorator)
                if "script" in decorator_str:
                    xlwings_functions.append(node.name)
                    break

    # If currently selected script is still here, return it at beginning
    if script_button_text in xlwings_functions:
        remaining = [x for x in xlwings_functions if x != script_button_text]
        return to_js([script_button_text] + remaining)

    return to_js(xlwings_functions)


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
