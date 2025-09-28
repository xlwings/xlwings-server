from fastapi.testclient import TestClient

from app import settings
from app.main import main_app

client = TestClient(main_app)


def test_custom_headers_applied(mocker):
    """Test that custom headers are applied to responses"""
    custom_headers = {
        "X-Custom-Header": "custom-value",
        "X-Another-Header": "another-value",
    }
    mocker.patch.object(settings, "custom_headers", custom_headers)

    response = client.get(f"{settings.app_path}/")

    assert response.headers["X-Custom-Header"] == "custom-value"
    assert response.headers["X-Another-Header"] == "another-value"


def test_custom_headers_override_default_security_headers(mocker):
    """Test that custom headers can override default security headers"""
    # Override a security header that would normally be set
    custom_headers = {"X-Content-Type-Options": "custom-value"}
    mocker.patch.object(settings, "custom_headers", custom_headers)
    mocker.patch.object(settings, "add_security_headers", True)

    response = client.get(f"{settings.app_path}/")

    # The custom header should override the default security header
    assert response.headers["X-Content-Type-Options"] == "custom-value"


def test_custom_headers_override_settings_based_headers(mocker):
    """Test that custom headers can override headers set by Excel Online/CDN settings"""
    custom_headers = {
        "Cross-Origin-Resource-Policy": "cors-value",  # Override Excel Online setting
        "X-Custom-Header": "custom-value",
    }
    mocker.patch.object(settings, "custom_headers", custom_headers)
    mocker.patch.object(settings, "add_security_headers", True)
    mocker.patch.object(
        settings, "enable_excel_online", True
    )  # This would normally set CORP to "cross-origin"

    response = client.get(f"{settings.app_path}/")

    # custom header should override the Excel Online setting
    assert response.headers["Cross-Origin-Resource-Policy"] == "cors-value"
    assert response.headers["X-Custom-Header"] == "custom-value"
    # X-Frame-Options should still be removed by Excel Online setting
    assert "X-Frame-Options" not in response.headers


def test_empty_custom_headers(mocker):
    """Test that empty custom_headers dict doesn't cause issues"""
    mocker.patch.object(settings, "custom_headers", {})
    mocker.patch.object(settings, "add_security_headers", True)

    response = client.get(f"{settings.app_path}/")

    # Should still get normal security headers
    assert response.status_code == 200
    # Check that at least one security header is present
    assert "X-Content-Type-Options" in response.headers
