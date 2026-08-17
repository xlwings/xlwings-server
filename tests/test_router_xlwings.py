import inspect

import pytest
import xlwings as xw
from bs4 import BeautifulSoup
from fastapi.testclient import TestClient

from xlwings_server import settings
from xlwings_server.main import main_app
from xlwings_server.routers import xlwings as xlwings_router

client = TestClient(main_app)

# hello_with_script (like the other side-effect examples) is only registered when Wasm is
# disabled, so tests that patch or call it must be skipped under Wasm. That's about this
# example module, not about WithScript, which works on the Wasm path too (see
# makeWasmCall in custom-functions-code.js).
requires_script_example = pytest.mark.skipif(
    settings.enable_wasm,
    reason="hello_with_script is not registered when Wasm is enabled",
)


def test_get_alert():
    # String to the right of $_hostInfo added by Excel
    response = client.get(
        f"{settings.app_path}/xlwings/alert?prompt=Exception(%27test%27)&title=Error&buttons=ok&mode=critical&callback=&_host_Info=Excel$Mac$16.01$en-US$telemetry$isDialog$$0"
    )
    assert response.status_code == 200
    assert (
        '<button id="ok" type="button" class="btn btn-primary btn-xl-alert">OK</button>'
        in response.text
    )
    assert '<h1 class="pt-4">Error</h1>' in response.text
    assert (
        "<p>Exception(&#39;test&#39;)</p>" in response.text
    )  # HTML escaping via Jinja

    # Check script tag
    soup = BeautifulSoup(response.text, "html.parser")
    script_tags = soup.find_all("script")
    script_tag = next(
        (tag for tag in script_tags if "alerts/dialog.js" in tag.get("src", "")), None
    )
    assert script_tag is not None
    script_response = client.get(script_tag["src"])
    assert script_response.status_code == 200


def test_custom_functions_meta():
    response = client.get(f"{settings.app_path}/xlwings/custom-functions-meta")
    assert response.status_code == 200
    # run via: pytest -s tests/test_router_xlwings.py::test_custom_functions_meta
    # print(repr(response.text))
    if settings.enable_wasm:
        expected = '{"allowCustomDataForDataTypeAny":true,"allowErrorForDataTypeAny":true,"functions":[{"description":"Like CORREL, but it works on whole matrices instead of just 2 arrays.","id":"CORREL","name":"CORREL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Like CORREL, but it works on whole matrices instead of just 2 arrays.","id":"CORREL2","name":"CORREL2","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Returns the address of the cell that called this function","id":"GET_CALLER","name":"GET_CALLER","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Python function \'hello\'","id":"HELLO","name":"HELLO","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"Custom name: appears in Excel as helloName","id":"HELLO_CUSTOM_NAME","name":"helloName","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"Returns an array of standard normally distributed pseudo random numbers","id":"STANDARD_NORMAL","name":"STANDARD_NORMAL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"The number of rows in the returned array.","name":"rows","dimensionality":"matrix","type":"any"},{"description":"The number of columns in the returned array.","name":"cols","dimensionality":"matrix","type":"any"}]}]}'
    else:
        expected = '{"allowCustomDataForDataTypeAny":true,"allowErrorForDataTypeAny":true,"functions":[{"description":"Object handle: Clear the object cache manually","id":"CLEAR_OBJECT_CACHE","name":"CLEAR_OBJECT_CACHE","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Like CORREL, but it works on whole matrices instead of just 2 arrays.","id":"CORREL","name":"CORREL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Like CORREL, but it works on whole matrices instead of just 2 arrays.","id":"CORREL2","name":"CORREL2","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Python function \'df_query\'","id":"DF_QUERY","name":"DF_QUERY","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"query","dimensionality":"matrix","type":"any"}]},{"description":"Returns the address of the cell that called this function","id":"GET_CALLER","name":"GET_CALLER","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Python function \'get_current_user\'","id":"GET_CURRENT_USER","name":"GET_CURRENT_USER","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Returns an object handle to the Excel cell (for production, this requires\\n    XLWINGS_OBJECT_CACHE_URL).","id":"GET_DF","name":"GET_DF","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Returns an object handle to the Excel cell (for production, this requires\\n    XLWINGS_OBJECT_CACHE_URL).","id":"GET_HEALTHEXP","name":"GET_HEALTHEXP","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"csv_url","dimensionality":"matrix","type":"any","optional":true}]},{"description":"Python function \'hello\'","id":"HELLO","name":"HELLO","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"Custom name: appears in Excel as helloName","id":"HELLO_CUSTOM_NAME","name":"helloName","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"This function requests a custom script after the custom function returns","id":"HELLO_WITH_SCRIPT","name":"HELLO_WITH_SCRIPT","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"In-Excel SQL\\n    see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql","id":"SQL","name":"SQL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"query","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"tables","dimensionality":"matrix","type":"any","repeating":true}]},{"description":"Returns an array of standard normally distributed pseudo random numbers","id":"STANDARD_NORMAL","name":"STANDARD_NORMAL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"The number of rows in the returned array.","name":"rows","dimensionality":"matrix","type":"any"},{"description":"The number of columns in the returned array.","name":"cols","dimensionality":"matrix","type":"any"}]},{"description":"Streaming function: must be provided as async generator,\\n    requires XLWINGS_ENABLE_SOCKETIO=true\\n    ","id":"STREAMING_RANDOM","name":"STREAMING_RANDOM","options":{"stream":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"rows","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"cols","dimensionality":"matrix","type":"any"}]},{"description":"Python function \'to_df\'","id":"TO_DF","name":"TO_DF","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Converts an object handle to cell values. `head` can be TRUE or an integer, which\\n    represents the number of rows from the top that you want to see. TRUE returns the\\n    first 5 rows.\\n    ","id":"VIEW","name":"VIEW","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"obj","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"head","dimensionality":"matrix","type":"any","optional":true}]}]}'
    assert (
        # Python 3.13 seems to strip out multiple spaces, even though that's supposed to only be done on docstrings
        response.text.replace("  ", "") == expected.replace("  ", "")
    )


def test_custom_functions_code():
    response = client.get(f"{settings.app_path}/xlwings/custom-functions-code")
    assert response.status_code == 200
    assert f"{settings.app_path}/xlwings/custom-functions-call" in response.text
    # `name=` aliases only affect the metadata name: the associate id and the
    # dispatch key stay derived from the Python function name
    assert (
        'CustomFunctions.associate("HELLO_CUSTOM_NAME", hello_custom_name);'
        in response.text
    )
    assert '["hello_custom_name", false]' in response.text


@pytest.mark.skipif(
    not hasattr(xw.server, "get_custom_function_namespace"),
    reason="Module namespaces require xlwings 0.36.13",
)
def test_custom_functions_meta_module_namespace(mocker):
    defining_module = inspect.getmodule(xlwings_router.custom_functions.hello)
    mocker.patch.object(
        defining_module,
        "__xlwings_func_namespace__",
        "finance",
        create=True,
    )

    response = client.get(f"{settings.app_path}/xlwings/custom-functions-meta")
    hello = next(
        function
        for function in response.json()["functions"]
        if function["id"] == "HELLO"
    )

    assert hello["name"] == "FINANCE.HELLO"


def test_custom_functions_call():
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.json() == {"result": [["Hello xlwings!"]]}
    # Functions that don't request a follow-up script must not add a "script" key
    assert "script" not in response.json()


def _call_get_caller(caller_address):
    return client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "get_caller",
            "args": [],
            "caller_address": caller_address,
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )


def test_custom_functions_call_with_caller():
    response = _call_get_caller("[Book1.xlsx]Sheet1!B21")
    assert response.json() == {"result": [["B21"]]}


def test_custom_functions_call_with_caller_without_workbook_prefix():
    """Older clients send a bare Sheet1!B21."""
    response = _call_get_caller("Sheet1!B21")
    assert response.json() == {"result": [["B21"]]}


def test_custom_functions_call_without_caller_address():
    """get_caller declares a bare `Caller`, which promises a value.

    Excel always sends an address for regular custom functions, so a missing one is an
    anomaly: it surfaces as an error in the cell rather than as an AttributeError from
    inside the function body.
    """
    response = _call_get_caller(None)
    assert response.status_code == 400
    assert "Could not determine the calling cell" in response.text


def test_custom_functions_call_with_invalid_caller_address():
    # XFE1 is past column XFD, which makes xlwings' col_name() raise IndexError. The
    # router must degrade to caller=None rather than turning that into a 500, and the
    # bare `Caller` hint then turns that None into a clear error.
    response = _call_get_caller("Sheet1!XFE1")
    assert response.status_code == 400
    assert "Could not determine the calling cell" in response.text


def test_custom_functions_call_invalid_caller_address_ignored():
    """A malformed address must not affect functions that don't use the Caller hint."""
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!XFE1",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.status_code == 200
    assert response.json() == {"result": [["Hello xlwings!"]]}


def test_caller_param_hidden_from_meta():
    """The Caller param is framework-provided, so Excel must not see it."""
    response = client.get(f"{settings.app_path}/xlwings/custom-functions-meta")
    get_caller = next(
        function
        for function in response.json()["functions"]
        if function["id"] == "GET_CALLER"
    )
    assert get_caller["parameters"] == []


@requires_script_example
def test_custom_functions_call_with_script():
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello_with_script",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.json() == {
        "result": [["Hello xlwings!"]],
        "script": {
            "script_name": "hello_args",
            "args": ["xlwings", 42],
            "include": "",
            "exclude": "",
            "lazy": False,
        },
    }


@requires_script_example
def test_custom_functions_call_with_async_script(monkeypatch):
    # Follow-up scripts may be async: the request only carries the script name, and the
    # follow-up call is an ordinary custom-scripts-call, which awaits coroutine scripts.
    # Covers both hops so that the script is shown to actually run.
    import asyncio

    from xlwings.server import script

    @script
    async def hello_async(book: xw.Book, name: str, number: int):
        await asyncio.sleep(0)
        book.sheets.active["A1"].value = f"async {name} {number}"

    monkeypatch.setattr(
        xlwings_router.custom_scripts, "hello_async", hello_async, raising=False
    )

    def calls_async_script(name):
        # Pass the coroutine function itself: the name is resolved via __name__, which
        # works the same for `async def`
        return xw.WithScript(f"Hello {name}!", hello_async, args=[name, 7])

    calls_async_script.__xlfunc__ = (
        xlwings_router.custom_functions.hello_with_script.__xlfunc__
    )
    monkeypatch.setattr(
        xlwings_router.custom_functions, "hello_with_script", calls_async_script
    )

    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello_with_script",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.json() == {
        "result": [["Hello xlwings!"]],
        "script": {
            "script_name": "hello_async",
            "args": ["xlwings", 7],
            "include": "",
            "exclude": "",
            "lazy": False,
        },
    }

    # Second hop: what the client does with the script request
    script_request = response.json()["script"]
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/"
        f"{script_request['script_name']}",
        json={
            "client": "Office.js",
            "version": xw.__version__,
            "args": script_request["args"],
            "book": {"name": "Book1", "active_sheet_index": 0, "selection": "A1"},
            "names": [],
            "sheets": [
                {"name": "Sheet1", "values": [[""]], "pictures": [], "tables": []}
            ],
        },
    )
    assert response.status_code == 200
    assert response.json()["actions"][0]["values"] == [["async xlwings 7"]]


@requires_script_example
def test_custom_functions_call_resolves_options_from_script(monkeypatch):
    # include/exclude/lazy are properties of the script (@script(...) and an xw.BookAsync
    # book parameter), not something the custom function chooses, so the route resolves
    # them from the script's metadata - same as a task pane button does.
    from xlwings.server import script

    @script(exclude=["Sheet1", "Sheet2"])
    def lazy_script(book: xw.BookAsync):
        pass

    @script
    def sync_script(book: xw.Book):
        pass

    monkeypatch.setattr(
        xlwings_router.custom_scripts, "lazy_script", lazy_script, raising=False
    )
    monkeypatch.setattr(
        xlwings_router.custom_scripts, "sync_script", sync_script, raising=False
    )

    def call(target):
        def calls_script(name):
            return xw.WithScript(f"Hello {name}!", target)

        calls_script.__xlfunc__ = (
            xlwings_router.custom_functions.hello_with_script.__xlfunc__
        )
        monkeypatch.setattr(
            xlwings_router.custom_functions, "hello_with_script", calls_script
        )
        response = client.post(
            f"{settings.app_path}/xlwings/custom-functions-call",
            json={
                "func_name": "hello_with_script",
                "args": [[["xlwings"]]],
                "caller_address": "Sheet1!B21",
                "version": xw.__version__,
                "runtime": "1.4",
            },
        )
        return response.json()["script"]

    # The list form of exclude is normalized to the comma-separated string the client
    # splits on
    assert call(lazy_script) == {
        "script_name": "lazy_script",
        "args": [],
        "include": "",
        "exclude": "Sheet1,Sheet2",
        "lazy": True,
    }
    assert call(sync_script) == {
        "script_name": "sync_script",
        "args": [],
        "include": "",
        "exclude": "",
        "lazy": False,
    }


@requires_script_example
def test_custom_functions_call_with_unknown_script(monkeypatch):
    # An unknown script name must fail on the producing call rather than silently
    # no-op'ing on the client. Patch the example to name a script that doesn't exist
    # (rather than deleting the real one, which the example resolves by attribute).
    def unknown_script(name):
        return xw.WithScript(f"Hello {name}!", "does_not_exist")

    unknown_script.__xlfunc__ = (
        xlwings_router.custom_functions.hello_with_script.__xlfunc__
    )
    monkeypatch.setattr(
        xlwings_router.custom_functions, "hello_with_script", unknown_script
    )

    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello_with_script",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.status_code == 400
    assert "does_not_exist" in response.json()["detail"]


@requires_script_example
def test_custom_functions_call_with_non_script_attribute(monkeypatch):
    # Modules re-export names like `settings` that exist but aren't custom scripts:
    # these must be rejected too, not just missing attributes
    assert hasattr(xlwings_router.custom_scripts, "settings")

    def names_a_module(name):
        return xw.WithScript(f"Hello {name}!", "settings")

    names_a_module.__xlfunc__ = (
        xlwings_router.custom_functions.hello_with_script.__xlfunc__
    )
    monkeypatch.setattr(
        xlwings_router.custom_functions, "hello_with_script", names_a_module
    )

    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello_with_script",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.status_code == 400
    assert "settings" in response.json()["detail"]


def test_custom_functions_call_with_custom_name():
    # Functions with a `name=` alias are still called via their Python name
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "hello_custom_name",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.json() == {"result": [["Hello xlwings!"]]}


def test_custom_functions_call_with_invalid_entraid_token(mocker):
    mocker.patch("xlwings_server.config.settings.auth_providers", ["entraid"])
    mocker.patch(
        "xlwings_server.config.settings.auth_entraid_tenant_id", "mocked_tenant_id"
    )
    mocker.patch(
        "xlwings_server.config.settings.auth_entraid_client_id", "mocked_client_id"
    )

    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        headers={"Authorization": "invalid token"},
        json={
            "func_name": "hello",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.status_code == 401


def test_custom_functions_call_missing_roles(mocker):
    mocker.patch("xlwings_server.config.settings.auth_providers", ["custom"])
    mocker.patch("xlwings_server.config.settings.auth_required_roles", ["role1"])
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        headers={"Authorization": "test-token"},
        json={
            "func_name": "hello",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.status_code == 403
    assert "Auth error: Missing roles" in str(response.text)


def test_custom_functions_call_anonymous(mocker):
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        headers={"Authorization": ""},
        json={
            "func_name": "hello",
            "args": [[["xlwings"]]],
            "caller_address": "Sheet1!B21",
            "content_language": "en-US",
            "version": xw.__version__,
            "runtime": "1.4",
        },
    )
    assert response.status_code == 200


def test_custom_scripts_call_with_invalid_entraid_token(mocker):
    mocker.patch("xlwings_server.config.settings.auth_providers", ["entraid"])
    mocker.patch(
        "xlwings_server.config.settings.auth_entraid_tenant_id", "mocked_tenant_id"
    )
    mocker.patch(
        "xlwings_server.config.settings.auth_entraid_client_id", "mocked_client_id"
    )

    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/hello_world",
        headers={"Authorization": "invalid token"},
        json={
            "client": "Office.js",
            "version": xw.__version__,
            "book": {"name": "Book1", "active_sheet_index": 0, "selection": "A2"},
            "names": [],
            "sheets": [
                {
                    "name": "Sheet1",
                    "values": [["Hello xlwings!"]],
                    "pictures": [],
                    "tables": [],
                }
            ],
        },
    )
    assert response.status_code == 401


def test_custom_scripts_call_missing_roles(mocker):
    mocker.patch("xlwings_server.config.settings.auth_providers", ["custom"])
    mocker.patch("xlwings_server.config.settings.auth_required_roles", ["role1"])
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/hello_world",
        headers={"Authorization": "test-token"},
        json={
            "client": "Office.js",
            "version": xw.__version__,
            "book": {"name": "Book1", "active_sheet_index": 0, "selection": "A2"},
            "names": [],
            "sheets": [
                {
                    "name": "Sheet1",
                    "values": [["Hello xlwings!"]],
                    "pictures": [],
                    "tables": [],
                }
            ],
        },
    )
    assert response.status_code == 403
    assert "Auth error: Missing roles" in str(response.text)


def test_custom_scripts_call_missing_authorization(mocker):
    mocker.patch("xlwings_server.config.settings.auth_providers", ["custom"])
    mocker.patch("xlwings_server.models.User.is_authorized", return_value=False)
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/hello_world",
        headers={"Authorization": "test-token"},
        json={
            "client": "Office.js",
            "version": xw.__version__,
            "book": {"name": "Book1", "active_sheet_index": 0, "selection": "A2"},
            "names": [],
            "sheets": [
                {
                    "name": "Sheet1",
                    "values": [["Hello xlwings!"]],
                    "pictures": [],
                    "tables": [],
                }
            ],
        },
    )
    assert response.status_code == 403
    assert "Auth error: Not authorized" in str(response.text)


def test_custom_scripts_call_anonymous(mocker):
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/hello_world",
        headers={"Authorization": ""},
        json={
            "client": "Office.js",
            "version": xw.__version__,
            "book": {"name": "Book1", "active_sheet_index": 0, "selection": "A2"},
            "names": [],
            "sheets": [
                {
                    "name": "Sheet1",
                    "values": [["Hello xlwings!"]],
                    "pictures": [],
                    "tables": [],
                }
            ],
        },
    )
    assert response.status_code == 200
