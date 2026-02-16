"""
On-Behalf-Of (OBO) flow for Microsoft Entra ID.
Exchanges an SSO access token for a downstream API token (e.g., Microsoft Graph).
See: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow
"""

import logging
import time

import httpx
from fastapi import HTTPException, status

from ...config import settings

logger = logging.getLogger(__name__)

# In-memory token cache: {cache_key: (access_token, expires_at)}
_obo_token_cache: dict[str, tuple[str, float]] = {}


async def acquire_obo_token(
    assertion: str,
    scopes: list[str] | None = None,
) -> str:
    """
    Exchange an SSO access token for a downstream API access token
    using the OBO flow.
    """
    if not settings.auth_entraid_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="XLWINGS_AUTH_ENTRAID_CLIENT_ID is required for the OBO flow.",
        )
    if not settings.auth_entraid_client_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="XLWINGS_AUTH_ENTRAID_CLIENT_SECRET is required for the OBO flow.",
        )

    tenant_id = settings.auth_entraid_tenant_id or "common"
    scopes = scopes or settings.auth_entraid_token_scopes

    # Check cache
    cache_key = f"{assertion}:{','.join(sorted(scopes))}"
    if cache_key in _obo_token_cache:
        cached_token, expires_at = _obo_token_cache[cache_key]
        if time.time() < expires_at - 300:  # 5-minute buffer
            logger.debug("Using cached OBO token")
            return cached_token
        else:
            del _obo_token_cache[cache_key]

    obo_token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "client_id": settings.auth_entraid_client_id,
        "client_secret": settings.auth_entraid_client_secret,
        "assertion": assertion,
        "scope": " ".join(scopes),
        "requested_token_use": "on_behalf_of",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(obo_token_url, data=data)

    if response.status_code != 200:
        error_data = response.json()
        error_code = error_data.get("error", "unknown")
        error_description = error_data.get("error_description", "")

        needs_consent = error_code in (
            "interaction_required",
            "consent_required",
        ) or (error_code == "invalid_grant" and "AADSTS65001" in error_description)

        if needs_consent:
            logger.warning(
                f"OBO flow requires admin consent for scopes: {scopes}. "
                "See: https://learn.microsoft.com/en-us/entra/identity-platform/"
                "v2-oauth2-on-behalf-of-flow#gaining-consent-for-the-middle-tier-application"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Graph API access requires admin consent. "
                    "Ask your admin to grant consent for the required permissions."
                ),
            )

        logger.error(f"OBO token exchange failed: {error_code}: {error_description}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to acquire Graph API token: {error_code}",
        )

    token_data = response.json()
    access_token = token_data["access_token"]
    expires_in = token_data.get("expires_in", 3600)

    _obo_token_cache[cache_key] = (access_token, time.time() + expires_in)
    logger.debug("OBO token acquired successfully")
    return access_token


class GraphClient:
    """
    Lightweight async client for Microsoft Graph API.

    Usage::

        async with await current_user.get_graph_client() as graph:
            response = await graph.get("/me")
            me = response.json()
            messages = await graph.get("/me/messages", params={"$top": 10})
            await graph.post("/me/sendMail", json={...})

    All methods return an httpx.Response object. Use .json(), .text, .content,
    .status_code, .headers, etc. as needed.
    """

    BASE_URL = "https://graph.microsoft.com/v1.0"

    def __init__(self, access_token: str):
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._client.aclose()

    async def get(self, path: str, **kwargs) -> httpx.Response:
        return await self._client.get(path, **kwargs)

    async def post(self, path: str, **kwargs) -> httpx.Response:
        return await self._client.post(path, **kwargs)

    async def patch(self, path: str, **kwargs) -> httpx.Response:
        return await self._client.patch(path, **kwargs)

    async def delete(self, path: str, **kwargs) -> httpx.Response:
        return await self._client.delete(path, **kwargs)


async def get_graph_client(
    user,
    scopes: list[str] | None = None,
) -> GraphClient:
    """
    Acquire an OBO token and return a GraphClient.
    Called from User.get_graph_client().
    """
    if not user.sso_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No SSO token available. Ensure authentication is configured.",
        )
    access_token = await acquire_obo_token(user.sso_token, scopes=scopes)
    return GraphClient(access_token)
