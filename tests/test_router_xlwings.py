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
    assert "<p>Exception('test')</p>" in response.text

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
    print(repr(response.text))  # run via pytest -s
    assert (
        response.text
        == '{"allowCustomDataForDataTypeAny":true,"allowErrorForDataTypeAny":true,"functions":[{"description":"This is a normal custom function","id":"HELLO","name":"HELLO","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"This function triggers a custom script (requires XLWINGS_ENABLE_SOCKETIO=true)","id":"HELLO_WITH_SCRIPT","name":"HELLO_WITH_SCRIPT","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"name","dimensionality":"matrix","type":"any"}]},{"description":"In-Excel SQL\\n    see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql","id":"SQL","name":"SQL","options":{"requiresAddress":true,"requiresParameterAddresses":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"query","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"tables","dimensionality":"matrix","type":"any","repeating":true}]},{"description":"This is a streaming function and must be provided as async generator","id":"STREAMING_RANDOM","name":"STREAMING_RANDOM","options":{"stream":true},"result":{"dimensionality":"matrix","type":"any"},"parameters":[{"description":"Positional argument 1","name":"rows","dimensionality":"matrix","type":"any"},{"description":"Positional argument 2","name":"cols","dimensionality":"matrix","type":"any"}]}]}'
    )


def test_custom_functions_code():
    response = client.get("xlwings/custom-functions-code")
    assert response.status_code == 200
    # print(repr(response.text))  # run via pytest -s
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
