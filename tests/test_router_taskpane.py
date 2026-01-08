from fastapi.testclient import TestClient

from xlwings_server.config import settings
from xlwings_server.main import main_app

client = TestClient(main_app)


def test_get_taskpane():
    response = client.get(f"{settings.app_path}/taskpane")
    assert response.status_code == 200
