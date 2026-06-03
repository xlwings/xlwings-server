import xlwings as xw
from fastapi.testclient import TestClient

from xlwings_server import settings
from xlwings_server.main import main_app

client = TestClient(main_app)

BOOK_PAYLOAD = {
    "client": "Office.js",
    "version": xw.__version__,
    "book": {"name": "Book1", "active_sheet_index": 0, "selection": "A1"},
    "names": [],
    "sheets": [
        {
            "name": "Sheet1",
            "values": [[]],
            "pictures": [],
            "tables": [],
        }
    ],
}


def test_custom_scripts_call_with_args():
    payload = {**BOOK_PAYLOAD, "args": ["Hello from test!", "A1"]}
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/write_value",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    action = data["actions"][0]
    assert action["func"] == "setValues"
    assert action["values"] == [["Hello from test!"]]


def test_custom_scripts_call_with_args_default():
    payload = {**BOOK_PAYLOAD, "args": ["Default target"]}
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/write_value",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    action = data["actions"][0]
    assert action["func"] == "setValues"
    assert action["values"] == [["Default target"]]


def test_custom_scripts_call_too_few_args():
    payload = {**BOOK_PAYLOAD, "args": []}
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/write_value",
        json=payload,
    )
    assert response.status_code == 400
    assert "missing required argument" in response.json()["detail"]


def test_custom_scripts_call_too_many_args():
    payload = {**BOOK_PAYLOAD, "args": ["a", "b", "c"]}
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/write_value",
        json=payload,
    )
    assert response.status_code == 400
    assert "extra argument" in response.json()["detail"]


def test_custom_scripts_call_no_args_backward_compat():
    response = client.post(
        f"{settings.app_path}/xlwings/custom-scripts-call/hello_world",
        json=BOOK_PAYLOAD,
    )
    assert response.status_code == 200
