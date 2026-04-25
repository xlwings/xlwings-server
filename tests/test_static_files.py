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
        "/wasm/wasm_runtime.py",
    ],
)
def test_static_endpoints(url_path):
    response = client.get(f"{settings.app_path}{url_path}")
    if not settings.enable_wasm:
        assert response.status_code == 404
    else:
        assert response.status_code == 200


def test_dist_static_served_in_non_dev(tmp_path, monkeypatch):
    """Test that dist/static is served when environment is not 'dev'."""
    # Create a temporary dist/static directory with a test file
    dist_static = tmp_path / "dist" / "static"
    dist_static.mkdir(parents=True)
    test_file = dist_static / "test.txt"
    test_file.write_text("dist static content")

    # Patch PROJECT_DIR and environment before importing the app
    monkeypatch.setenv("XLWINGS_PROJECT_DIR", str(tmp_path))
    monkeypatch.setenv("XLWINGS_ENVIRONMENT", "prod")

    # Need to reload the modules to pick up the new PROJECT_DIR
    import importlib

    import xlwings_server.config
    import xlwings_server.main

    importlib.reload(xlwings_server.config)
    importlib.reload(xlwings_server.main)

    from xlwings_server.main import main_app as reloaded_app

    test_client = TestClient(reloaded_app)
    response = test_client.get("/static/test.txt")
    assert response.status_code == 200
    assert response.text == "dist static content"


def test_dist_static_ignored_in_dev(tmp_path, monkeypatch):
    """Test that dist/static is ignored when environment is 'dev'."""
    # Create a temporary dist/static directory with a test file
    dist_static = tmp_path / "dist" / "static"
    dist_static.mkdir(parents=True)
    test_file = dist_static / "test_dev.txt"
    test_file.write_text("dist static content")

    # Patch PROJECT_DIR and environment before importing the app
    monkeypatch.setenv("XLWINGS_PROJECT_DIR", str(tmp_path))
    monkeypatch.setenv("XLWINGS_ENVIRONMENT", "dev")

    # Need to reload the modules to pick up the new PROJECT_DIR
    import importlib

    import xlwings_server.config
    import xlwings_server.main

    importlib.reload(xlwings_server.config)
    importlib.reload(xlwings_server.main)

    from xlwings_server.main import main_app as reloaded_app

    test_client = TestClient(reloaded_app)
    # File should not be found since dist/static is ignored in dev
    response = test_client.get("/static/test_dev.txt")
    assert response.status_code == 404
