import logging
import re
from typing import List, Optional

import httpx
from aiocache import Cache, cached
from fastapi import Depends, Header, status
from fastapi.exceptions import HTTPException
from joserfc import jwt
from joserfc.jwk import KeySet
from joserfc.jwt import JWTClaimsRegistry
from pydantic import BaseModel

from ..config import settings
from . import jwks

logger = logging.getLogger(__name__)

OPENID_CONNECT_DISCOVERY_DOCUMENT_URL = (
    "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration"
)


class User(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    roles: Optional[List[str]] = []


@cached(ttl=60 * 60 * 24, cache=Cache.MEMORY)
async def get_jwks_json_default():
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


@cached(ttl=60 * 60, cache=Cache.MEMORY)
async def validate_token(token_string: str):
    """Function that reads and validates the Entra ID access/id token.
    Returns a user object."""
    if not settings.entraid_tenant_id and not settings.entraid_client_id:
        return User(id="n/a", name="Anonymous")
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
    token = jwt.decode(token_string, key_set)
    token_version = token.claims.get("ver")
    # https://learn.microsoft.com/en-us/azure/active-directory/develop/access-tokens#token-formats
    # Upgrade to 2.0:
    # https://learn.microsoft.com/en-us/answers/questions/639834/how-to-get-access-token-version-20.html
    if token_version == "1.0":
        issuer = f"https://sts.windows.net/{settings.entraid_tenant_id}/"
        audience = f"api://{settings.entraid_client_id}"
    elif token_version == "2.0":
        issuer = f"https://login.microsoftonline.com/{settings.entraid_tenant_id}/v2.0"
        audience = settings.entraid_client_id
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth error: Unsupported token version: {token_version}",
        )
    try:
        if settings.entraid_multitenant:
            claims_requests = JWTClaimsRegistry(
                aud={"essential": True, "value": audience},
                iss={"essential": True, "value": issuer},
            )
            claims_requests.validate(token.claims)
        else:
            claims_requests = JWTClaimsRegistry(
                aud={"value": audience},
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

    current_user = User(
        id=token.claims.get("oid"),
        name=token.claims.get("name"),
        email=token.claims.get("preferred_username"),
        roles=token.claims.get("roles", []),
    )
    logger.info(f"User authenticated: {current_user.name}")
    return current_user


def authorize(user: User, roles: list = None):
    if roles:
        if set(roles).issubset(user.roles):
            logger.info(f"User authorized: {user.name}")
            return user
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Auth error: Missing roles for {user.name}: {', '.join(set(roles).difference(user.roles))}",
            )
    else:
        return user


async def authenticate(token_string: str = Header(default="", alias="Authorization")):
    """Dependency, returns a user object"""
    return await validate_token(token_string)


class Authorizer:
    """This class can be used to create dependencies that require specific roles:

    get_specific_user = Authorizer(roles=["role1", "role2"])

    Returns a user object.
    """

    def __init__(self, roles: list = None):
        self.roles = roles

    def __call__(self, current_user: User = Depends(authenticate)):
        return authorize(current_user, self.roles)


# Dependencies for RBAC
get_user = Authorizer()
get_admin = Authorizer(roles=["admin"])
