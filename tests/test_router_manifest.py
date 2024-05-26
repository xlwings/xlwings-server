from fastapi.testclient import TestClient

from app import settings
from app.main import main_app

client = TestClient(main_app)


def test_get_manifest_nonprod():
    response = client.get("/manifest")
    assert response.status_code == 200
    assert "text/plain" in response.headers["Content-Type"]
    assert '<DisplayName DefaultValue="Test Project [test]" />' in response.text
    assert (
        '<bt:String id="Functions.Namespace" DefaultValue="XLWINGS_TEST" />'
        in response.text
    )


def test_get_manifest_prod(monkeypatch):
    monkeypatch.setattr(settings, "environment", "prod")
    response = client.get("/manifest")
    assert response.status_code == 200
    assert "text/plain" in response.headers["Content-Type"]
    assert '<DisplayName DefaultValue="Test Project" />' in response.text
    assert (
        '<bt:String id="Functions.Namespace" DefaultValue="XLWINGS" />' in response.text
    )


def test_empty_function_namespace_prod(monkeypatch):
    monkeypatch.setattr(settings, "environment", "prod")
    monkeypatch.setattr(settings, "functions_namespace", "")
    response = client.get("/manifest")
    assert '<bt:String id="Functions.Namespace" DefaultValue="" />' in response.text


def test_empty_function_namespace_nonprod(monkeypatch):
    monkeypatch.setattr(settings, "functions_namespace", "")
    response = client.get("/manifest")
    assert '<bt:String id="Functions.Namespace" DefaultValue="TEST" />' in response.text
