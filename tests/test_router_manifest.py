from fastapi.testclient import TestClient

from app import settings
from app.main import main_app

client = TestClient(main_app)


def test_get_manifest_nonprod():
    response = client.get("/manifest")
    assert response.status_code == 200
    assert "text/plain" in response.headers["Content-Type"]
    assert '<DisplayName DefaultValue="Test Project [qa]" />' in response.text
    assert (
        '<bt:String id="Functions.Namespace" DefaultValue="XLWINGS_QA" />'
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
    assert '<bt:String id="Functions.Namespace" DefaultValue="QA" />' in response.text


def test_entraid_auth_deactivated(monkeypatch):
    response = client.get("/manifest")
    assert "<WebApplicationInfo>" not in response.text


def test_entraid_auth_activated(monkeypatch):
    monkeypatch.setattr(
        settings, "entraid_client_id", "5be64098-090e-4183-ac32-e35f09379bb1"
    )
    monkeypatch.setattr(
        settings, "entraid_tenant_id", "efadd9e3-83b3-41f8-86d1-c0ea7ad203ad"
    )
    response = client.get("/manifest")
    assert "<WebApplicationInfo>" in response.text
