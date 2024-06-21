import pytest

from app.auth.entraid import get_key_set


@pytest.mark.anyio
async def test_custom_get_jwks_json(mocker):
    mock_get_jwks_json = mocker.patch(
        "app.auth.entraid.jwks.get_jwks_json",
        return_value={"keys": [{"kty": "RSA", "n": "test", "e": "AQAB"}]},
    )
    await get_key_set()
    mock_get_jwks_json.assert_called_once()
