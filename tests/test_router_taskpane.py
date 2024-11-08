from fastapi.testclient import TestClient

from app.config import settings
from app.main import main_app

client = TestClient(main_app)


def test_get_taskpane():
    response = client.get(f"{settings.app_path}/taskpane")
    assert response.status_code == 200
    assert "<h1>Example Task Pane</h1>" in response.text
