from fastapi.testclient import TestClient

from app import settings
from app.main import main_app

client = TestClient(main_app)


def test_get_manifest_nonprod():
    response = client.get(f"{settings.app_path}/manifest")
    assert response.status_code == 200
    assert "text/plain" in response.headers["Content-Type"]
    assert '<DisplayName DefaultValue="Test Project [qa]" />' in response.text
    assert (
        '<bt:String id="Functions.Namespace" DefaultValue="XLWINGS_QA" />'
        in response.text
    )


def test_get_manifest_prod(mocker):
    mocker.patch.object(settings, "environment", "prod")
    response = client.get(f"{settings.app_path}/manifest")
    assert response.status_code == 200
    assert "text/plain" in response.headers["Content-Type"]
    assert '<DisplayName DefaultValue="Test Project" />' in response.text
    assert (
        '<bt:String id="Functions.Namespace" DefaultValue="XLWINGS" />' in response.text
    )


def test_empty_function_namespace_prod(mocker):
    mocker.patch.object(settings, "environment", "prod")
    mocker.patch.object(settings, "functions_namespace", "")
    response = client.get(f"{settings.app_path}/manifest")
    assert "Functions.Namespace" not in response.text


def test_empty_function_namespace_nonprod(mocker):
    mocker.patch.object(settings, "functions_namespace", "")
    response = client.get(f"{settings.app_path}/manifest")
    assert '<bt:String id="Functions.Namespace" DefaultValue="QA" />' in response.text


def test_entraid_auth_deactivated():
    response = client.get(f"{settings.app_path}/manifest")
    assert "<WebApplicationInfo>" not in response.text


def test_entraid_auth_activated(mocker):
    mocker.patch.object(settings, "auth_providers", "entraid")
    mocker.patch.object(
        settings, "auth_entraid_client_id", "5be64098-090e-4183-ac32-e35f09379bb1"
    )
    mocker.patch.object(
        settings, "auth_entraid_tenant_id", "efadd9e3-83b3-41f8-86d1-c0ea7ad203ad"
    )
    response = client.get(f"{settings.app_path}/manifest")
    assert "<WebApplicationInfo>" in response.text
