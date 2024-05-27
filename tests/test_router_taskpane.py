from fastapi.testclient import TestClient

from app.main import main_app

client = TestClient(main_app)


def test_get_taskpane():
    response = client.get("/taskpane")
    assert response.status_code == 200
    assert "<h1>Hello World Example</h1>" in response.text
