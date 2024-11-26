import pytest
from fastapi.testclient import TestClient

from app import settings
from app.main import main_app

client = TestClient(main_app)


@pytest.mark.parametrize(
    "url_path",
    [
        "/custom_functions/examples.py",
        "/custom_scripts/examples.py",
        "/lite/main.py",
    ],
)
def test_static_endpoints(url_path):
    response = client.get(f"{settings.app_path}{url_path}")
    if not settings.enable_lite:
        assert response.status_code == 404
    else:
        assert response.status_code == 200
