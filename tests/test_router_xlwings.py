import xlwings as xw
from bs4 import BeautifulSoup
from fastapi.testclient import TestClient

from app import settings
from app.main import main_app

client = TestClient(main_app)


def test_get_alert():
    # String to the right of $_hostInfo added by Excel
    response = client.get(
        "xlwings/alert?prompt=Exception(%27test%27)&title=Error&buttons=ok&mode=critical&callback=&_host_Info=Excel$Mac$16.01$en-US$telemetry$isDialog$$0"
    )
    assert response.status_code == 200
    assert (
        '<button id="ok" type="button" class="btn btn-primary btn-xl-alert">OK</button>'
        in response.text
    )
    assert '<h1 class="pt-4">Error</h1>' in response.text
    assert "<p>Exception(&#39;test&#39;)</p>" in response.text

    # Check script tag
    soup = BeautifulSoup(response.text, "html.parser")
    script_tags = soup.find_all("script")
    script_tag = next(
        (tag for tag in script_tags if "xlwings-alert.js" in tag.get("src", "")), None
    )
    assert script_tag is not None
    script_response = client.get(script_tag["src"])
    assert script_response.status_code == 200


def test_custom_functions_meta():
    response = client.get("xlwings/custom-functions-meta")
    assert response.status_code == 200
    # run via: pytest -s tests/test_router_xlwings.py::test_custom_functions_meta
    # print(repr(response.text))
    assert (
        response.text
        == '{"allowCustomDataForDataTypeAny":true,"allowErrorForDataTypeAny":true,"functions":[{"description":"Object handle: Clear the object cache manually","id":"CLEAR_OBJECT_CACHE","name":"CLEAR_OBJECT_CACHE","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Like CORREL, but it works on whole matrices instead of just 2 arrays.","id":"CORREL","name":"CORREL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Like CORREL, but it works on whole matrices instead of just 2 arrays.","id":"CORREL2","name":"CORREL2","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Python function \'df_query\'","id":"DF_QUERY","name":"DF_QUERY","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"query","dimensionality":"matrix","type":"any"}]},{"description":"Python function \'get_current_user\'","id":"GET_CURRENT_USER","name":"GET_CURRENT_USER","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Returns an object handle to the Excel cell (for production, this requires\\n    XLWINGS_OBJECT_CACHE_URL).","id":"GET_DF","name":"GET_DF","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[]},{"description":"Returns an object handle to the Excel cell (for production, this requires\\n    XLWINGS_OBJECT_CACHE_URL).","id":"GET_HEALTHEXP","name":"GET_HEALTHEXP","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"csv_url","dimensionality":"matrix","type":"any","optional":true}]},{"description":"Python function \'hello\'","id":"HELLO","name":"HELLO","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"This function triggers a custom script, requires XLWINGS_ENABLE_SOCKETIO=true","id":"HELLO_WITH_SCRIPT","name":"HELLO_WITH_SCRIPT","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"In-Excel SQL\\n    see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql","id":"SQL","name":"SQL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"query","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"tables","dimensionality":"matrix","type":"any","repeating":true}]},{"description":"Returns an array of standard normally distributed pseudo random numbers","id":"STANDARD_NORMAL","name":"STANDARD_NORMAL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"The number of rows in the returned array.","name":"rows","dimensionality":"matrix","type":"any"},{"description":"The number of columns in the returned array.","name":"cols","dimensionality":"matrix","type":"any"}]},{"description":"Streaming function: must be provided as async generator,\\n    requires XLWINGS_ENABLE_SOCKETIO=true\\n    ","id":"STREAMING_RANDOM","name":"STREAMING_RANDOM","options":{"stream":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"rows","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"cols","dimensionality":"matrix","type":"any"}]},{"description":"Python function \'to_df\'","id":"TO_DF","name":"TO_DF","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"df","dimensionality":"matrix","type":"any"}]},{"description":"Converts an object handle to cell values. `head` can be TRUE or an integer, which\\n    represents the number of rows from the top that you want to see. TRUE returns the\\n    first 5 rows.\\n    ","id":"VIEW","name":"VIEW","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"obj","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"head","dimensionality":"matrix","type":"any","optional":true}]}]}'
    )


def test_custom_functions_code():
    response = client.get("xlwings/custom-functions-code")
    assert response.status_code == 200
    assert 'window.location.origin + "/xlwings/custom-functions-call"' in response.text


def test_custom_functions_code_with_app_path(mocker):
    mocker.patch.object(settings, "app_path", "/x/y")
    response = client.get("xlwings/custom-functions-code")
    assert response.status_code == 200
    assert (
        'window.location.origin + "/x/y/xlwings/custom-functions-call"' in response.text
    )


def test_custom_functions_call():
    response = client.post(
        "/xlwings/custom-functions-call",
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


def test_custom_functions_call_with_invalid_entraid_token(mocker):
    mocker.patch("app.config.settings.auth_providers", ["entraid"])
    mocker.patch("app.config.settings.auth_entraid_tenant_id", "mocked_tenant_id")
    mocker.patch("app.config.settings.auth_entraid_client_id", "mocked_client_id")

    response = client.post(
        "/xlwings/custom-functions-call",
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
    mocker.patch("app.config.settings.auth_providers", ["custom"])
    mocker.patch("app.config.settings.auth_required_roles", ["role1"])
    response = client.post(
        "/xlwings/custom-functions-call",
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
    assert response.status_code == 403
    assert "Auth error: Missing roles" in str(response.text)


def test_custom_functions_call_anonymous(mocker):
    response = client.post(
        "/xlwings/custom-functions-call",
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
    mocker.patch("app.config.settings.auth_providers", ["entraid"])
    mocker.patch("app.config.settings.auth_entraid_tenant_id", "mocked_tenant_id")
    mocker.patch("app.config.settings.auth_entraid_client_id", "mocked_client_id")

    response = client.post(
        "/xlwings/custom-scripts-call/hello_world",
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
    mocker.patch("app.config.settings.auth_providers", ["custom"])
    mocker.patch("app.config.settings.auth_required_roles", ["role1"])
    response = client.post(
        "/xlwings/custom-scripts-call/hello_world",
        headers={"Authorization": "token"},
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
    mocker.patch("app.config.settings.auth_providers", ["custom"])
    mocker.patch("app.models.User.is_authorized", return_value=False)
    response = client.post(
        "/xlwings/custom-scripts-call/hello_world",
        headers={"Authorization": "token"},
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
        "/xlwings/custom-scripts-call/hello_world",
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
