import pytest
from fastapi import HTTPException

from app import settings
from app.dependencies import authenticate


@pytest.mark.anyio
async def test_no_auth_providers_configured(mocker):
    mocker.patch.object(settings, "auth_providers", None)
    user = await authenticate(token_string="token")
    assert user.id == "n/a" and user.name == "Anonymous"


@pytest.mark.anyio
async def test_multiple_auth_providers_without_auth_provider_header(mocker):
    mocker.patch("app.config.settings.auth_providers", ["provider1", "provider2"])
    with pytest.raises(HTTPException) as exc_info:
        await authenticate(token_string="token", auth_provider=None)
    assert exc_info.value.status_code == 400
    assert (
        "With multiple auth providers, you need to provide the Auth-Provider header."
        in str(exc_info.value.detail)
    )


@pytest.mark.anyio
async def test_invalid_auth_provider_header(mocker):
    mocker.patch("app.config.settings.auth_providers", ["provider1", "provider2"])
    with pytest.raises(HTTPException) as exc_info:
        await authenticate(token_string="token", auth_provider="invalid_provider")
    assert exc_info.value.status_code == 400
    assert (
        "Auth-Provider header wasn't found in XLWINGS_AUTH_PROVIDERS setting."
        in str(exc_info.value.detail)
    )


@pytest.mark.anyio
async def test_auth_provider_not_found(mocker):
    mocker.patch("app.config.settings.auth_providers", ["provider1"])
    with pytest.raises(HTTPException) as exc_info:
        await authenticate(token_string="token")
    assert exc_info.value.status_code == 500
    assert "Auth provider 'provider1' implementation missing." in str(
        exc_info.value.detail
    )
