import pytest
from fastapi.testclient import TestClient

from xlwings_server import settings
from xlwings_server.main import main_app

client = TestClient(main_app)


@pytest.mark.parametrize(
    "url_path",
    [
        "/custom_functions/examples.py",
        "/custom_scripts/examples.py",
        "/wasm/main.py",
    ],
)
def test_static_endpoints(url_path):
    response = client.get(f"{settings.app_path}{url_path}")
    if not settings.enable_wasm:
        assert response.status_code == 404
    else:
        assert response.status_code == 200
