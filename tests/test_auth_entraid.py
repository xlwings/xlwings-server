import pytest
from fastapi import HTTPException, status

import app.auth.entraid
from app.auth.entraid import get_key_set, validate_token


@pytest.mark.anyio
async def test_custom_get_jwks_json(mocker):
    mock_get_jwks_json = mocker.patch(
        "app.auth.entraid.jwks.get_jwks_json",
        return_value={"keys": [{"kty": "RSA", "n": "test", "e": "AQAB"}]},
    )
    spy_get_jwks_json_default = mocker.spy(app.auth.entraid, "get_jwks_json_default")
    await get_key_set()
    mock_get_jwks_json.assert_called_once()
    spy_get_jwks_json_default.assert_not_called()


@pytest.mark.anyio
async def test_default_get_jwks_json(mocker):
    spy_get_jwks_json_default = mocker.spy(app.auth.entraid, "get_jwks_json_default")
    await get_key_set()
    spy_get_jwks_json_default.assert_called_once()


@pytest.mark.anyio
@pytest.mark.parametrize("token_string", ["Invalid token", "Bearer invalid token"])
async def test_validate_token_invalid_format(token_string):
    with pytest.raises(HTTPException) as exc_info:
        await validate_token(token_string)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "must be in format 'Bearer xxxx'" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_token_string_starts_with_error():
    token_string = "Error: Invalid token"
    with pytest.raises(HTTPException) as exc_info:
        await validate_token(token_string)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Auth error with Entra ID token" in str(exc_info.value.detail)
