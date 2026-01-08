"""
See https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
"""

import logging
import re

import httpx
from aiocache import cached
from fastapi import Depends, Header, status
from fastapi.exceptions import HTTPException
from joserfc import jwt
from joserfc.jwk import KeySet
from joserfc.jwt import JWTClaimsRegistry

from ... import models
from ...config import settings

# Try to import jwks from project directory first (user override)
# Fall back to package location (default implementation)
try:
    from auth.entraid import jwks
except ModuleNotFoundError:
    from . import jwks

logger = logging.getLogger(__name__)

OPENID_CONNECT_DISCOVERY_DOCUMENT_URL = (
    "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
)


@cached(ttl=60 * 60 * 24)
async def get_jwks_json_default():
    logger.info("Get default JWKS json for Entra ID")
    async with httpx.AsyncClient() as client:
        response = await client.get(OPENID_CONNECT_DISCOVERY_DOCUMENT_URL)
    jwks_uri = response.json()["jwks_uri"]
    async with httpx.AsyncClient() as client:
        response = await client.get(jwks_uri)
    return response.json()


async def get_key_set():
    jwks_data = await jwks.get_jwks_json()
    if jwks_data is None:
        jwks_data = await get_jwks_json_default()
    key_set = KeySet.import_key_set(jwks_data)
    return key_set


@cached(ttl=60 * 60)
async def validate_token(token_string: str):
    """Validates the Entra ID access/id token. Returns a user object."""
    logger.debug(f"Validating token: {token_string}")
    if token_string.lower().startswith("error"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth error with Entra ID token: {token_string} See https://learn.microsoft.com/en-us/office/dev/add-ins/develop/troubleshoot-sso-in-office-add-ins#causes-and-handling-of-errors-from-getaccesstoken",
        )
    if token_string.lower().startswith("bearer"):
        parts = token_string.split()
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Auth error: Invalid token, must be in format 'Bearer xxxx'",
            )
        token_string = parts[1]
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth error: Invalid token, must be in format 'Bearer xxxx'",
        )
    key_set = await get_key_set()
    try:
        token = jwt.decode(token_string, key_set)
    except Exception:
        logger.exception("Auth error: Failed to decode token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth error: Failed to decode token",
        )
    token_version = token.claims.get("ver")
    # https://learn.microsoft.com/en-us/azure/active-directory/develop/access-tokens#token-formats
    # Upgrade to 2.0:
    # https://learn.microsoft.com/en-us/answers/questions/639834/how-to-get-access-token-version-20.html
    if token_version == "1.0":
        issuer = f"https://sts.windows.net/{settings.auth_entraid_tenant_id}/"
        audience = f"api://{settings.auth_entraid_client_id}"
    elif token_version == "2.0":
        issuer = (
            f"https://login.microsoftonline.com/{settings.auth_entraid_tenant_id}/v2.0"
        )
        audience = settings.auth_entraid_client_id
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth error: Unsupported token version: {token_version}",
        )
    try:
        if not settings.auth_entraid_multitenant:
            claims_requests = JWTClaimsRegistry(
                aud={"essential": True, "value": audience},
                iss={"essential": True, "value": issuer},
            )
            claims_requests.validate(token.claims)
        else:
            claims_requests = JWTClaimsRegistry(
                aud={"essential": True, "value": audience},
            )
            claims_requests.validate(token.claims)
            # External users have their own tenant_id
            issuer_regex = r"https://login\.microsoftonline\.com/(common|organizations|consumers|[0-9a-fA-F-]{36})/v2\.0"
            if not re.match(issuer_regex, issuer):
                logger.debug(f"Couldn't match issuer for token: {token_string}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Auth error: Couldn't validate token",
                )
        logger.debug(claims_requests)
    except Exception as e:
        logger.debug(f"Authentication error for token: {token_string}")
        logger.info(repr(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth error: Couldn't validate token",
        )

    current_user = models.User(claims=token.claims)
    logger.info(f"User authenticated: {current_user.name}")
    return current_user
