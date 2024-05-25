from fastapi.testclient import TestClient

from app.main import main_app

client = TestClient(main_app)


def test_read_main():
    response = client.get("/manifest")
    assert response.status_code == 200
