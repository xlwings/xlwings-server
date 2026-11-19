"""JS `null` in script arguments of the WASM runtime.

`wasm_runtime.py` imports `js` and Pyodide, so the helper is extracted from the
module's AST and run against a stand-in for `pyodide.ffi.JsNull`.
"""

import ast
from pathlib import Path

import pytest

WASM_RUNTIME = (
    Path(__file__).resolve().parents[1] / "xlwings_server" / "wasm" / "wasm_runtime.py"
)


class JsNull:
    """Stands in for `pyodide.ffi.JsNull`: falsy, but not `None`."""

    def __bool__(self):
        return False


@pytest.fixture(scope="module")
def replace_jsnull():
    tree = ast.parse(WASM_RUNTIME.read_text())
    selected = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "_replace_jsnull"
    ]
    assert selected, "_replace_jsnull not found in wasm_runtime.py"
    namespace = {}
    exec(
        compile(ast.Module(body=selected, type_ignores=[]), WASM_RUNTIME, "exec"),
        namespace,
    )
    return namespace["_replace_jsnull"]


def test_replace_jsnull_at_every_level(replace_jsnull):
    jsnull = JsNull()
    args = [jsnull, [1, "a", jsnull], {"k": jsnull, "values": [jsnull]}]
    assert replace_jsnull(args, JsNull) == [
        None,
        [1, "a", None],
        {"k": None, "values": [None]},
    ]


def test_replace_jsnull_keeps_falsy_values(replace_jsnull):
    args = [False, 0, "", [], {}, None]
    assert replace_jsnull(args, JsNull) == args
