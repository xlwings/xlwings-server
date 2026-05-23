import pytest
from fastapi import HTTPException, status

import xlwings_server.auth.entraid
from xlwings_server.auth.entraid import get_key_set, validate_token


@pytest.mark.anyio
async def test_custom_get_jwks_json(mocker):
    # Use a valid 2048-bit RSA modulus to avoid SecurityWarning
    mock_get_jwks_json = mocker.patch(
        "xlwings_server.auth.entraid.jwks.get_jwks_json",
        return_value={
            "keys": [
                {
                    "kty": "RSA",
                    "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
                    "e": "AQAB",
                }
            ]
        },
    )
    spy_get_jwks_json_default = mocker.spy(
        xlwings_server.auth.entraid, "get_jwks_json_default"
    )
    await get_key_set()
    mock_get_jwks_json.assert_called_once()
    spy_get_jwks_json_default.assert_not_called()


@pytest.mark.anyio
async def test_default_get_jwks_json(mocker):
    # Stub out the network round-trip; we only care that the default path is
    # taken when no custom get_jwks_json is configured.
    mock_get_jwks_json_default = mocker.patch(
        "xlwings_server.auth.entraid.get_jwks_json_default",
        return_value={
            "keys": [
                {
                    "kty": "RSA",
                    "n": "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
                    "e": "AQAB",
                }
            ]
        },
    )
    await get_key_set()
    mock_get_jwks_json_default.assert_called_once()


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
