import httpx
import pytest
from fastapi import HTTPException, status

from xlwings_server import models
from xlwings_server.auth.entraid import obo
from xlwings_server.auth.entraid.obo import (
    GraphClient,
    _obo_token_cache,
    acquire_obo_token,
    get_graph_client,
)


@pytest.fixture(autouse=True)
def clear_obo_cache():
    _obo_token_cache.clear()
    yield
    _obo_token_cache.clear()


@pytest.fixture
def mock_settings(mocker):
    mocker.patch.object(
        obo,
        "settings",
        mocker.Mock(
            auth_entraid_client_id="test-client-id",
            auth_entraid_client_secret="test-client-secret",
            auth_entraid_tenant_id="test-tenant-id",
            auth_entraid_token_scopes=["https://graph.microsoft.com/.default"],
        ),
    )


@pytest.fixture
def mock_obo_response(mocker):
    """Returns a helper that mocks the httpx POST to the token endpoint."""

    def _mock(status_code=200, json_data=None):
        if json_data is None:
            json_data = {
                "access_token": "mock-obo-token",
                "expires_in": 3600,
                "token_type": "Bearer",
            }
        response = httpx.Response(status_code, json=json_data)
        mock_client = mocker.AsyncMock()
        mock_client.post.return_value = response
        mock_client.__aenter__ = mocker.AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = mocker.AsyncMock(return_value=False)
        mocker.patch(
            "xlwings_server.auth.entraid.obo.httpx.AsyncClient",
            return_value=mock_client,
        )
        return mock_client

    return _mock


# --- acquire_obo_token ---


@pytest.mark.anyio
async def test_acquire_obo_token_missing_client_id(mocker):
    mocker.patch.object(
        obo,
        "settings",
        mocker.Mock(
            auth_entraid_client_id=None,
            auth_entraid_client_secret="secret",
        ),
    )
    with pytest.raises(HTTPException) as exc_info:
        await acquire_obo_token("sso-token")
    assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert "CLIENT_ID" in exc_info.value.detail


@pytest.mark.anyio
async def test_acquire_obo_token_missing_client_secret(mocker):
    mocker.patch.object(
        obo,
        "settings",
        mocker.Mock(
            auth_entraid_client_id="client-id",
            auth_entraid_client_secret=None,
        ),
    )
    with pytest.raises(HTTPException) as exc_info:
        await acquire_obo_token("sso-token")
    assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert "CLIENT_SECRET" in exc_info.value.detail


@pytest.mark.anyio
async def test_acquire_obo_token_success(mock_settings, mock_obo_response):
    mock_obo_response()
    token = await acquire_obo_token("sso-token")
    assert token == "mock-obo-token"


@pytest.mark.anyio
async def test_acquire_obo_token_caches_token(mock_settings, mock_obo_response):
    mock_client = mock_obo_response()
    token1 = await acquire_obo_token("sso-token")
    token2 = await acquire_obo_token("sso-token")
    assert token1 == token2
    # Only one HTTP call — second was served from cache
    assert mock_client.post.call_count == 1


@pytest.mark.anyio
async def test_acquire_obo_token_cache_expired(
    mock_settings, mock_obo_response, mocker
):
    mock_client = mock_obo_response(
        json_data={
            "access_token": "mock-obo-token",
            "expires_in": 100,  # less than 300s buffer
            "token_type": "Bearer",
        }
    )
    await acquire_obo_token("sso-token")
    # Token is cached but already within the 5-minute buffer, so next call fetches again
    await acquire_obo_token("sso-token")
    assert mock_client.post.call_count == 2


@pytest.mark.anyio
@pytest.mark.parametrize("error_code", ["interaction_required", "consent_required"])
async def test_acquire_obo_token_consent_error(
    mock_settings, mock_obo_response, error_code
):
    mock_obo_response(
        status_code=400,
        json_data={
            "error": error_code,
            "error_description": "Consent required",
        },
    )
    with pytest.raises(HTTPException) as exc_info:
        await acquire_obo_token("sso-token")
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "admin consent" in exc_info.value.detail


@pytest.mark.anyio
async def test_acquire_obo_token_aadsts65001(mock_settings, mock_obo_response):
    mock_obo_response(
        status_code=400,
        json_data={
            "error": "invalid_grant",
            "error_description": "AADSTS65001: The user has not consented",
        },
    )
    with pytest.raises(HTTPException) as exc_info:
        await acquire_obo_token("sso-token")
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.anyio
async def test_acquire_obo_token_other_error(mock_settings, mock_obo_response):
    mock_obo_response(
        status_code=400,
        json_data={
            "error": "invalid_request",
            "error_description": "Something went wrong",
        },
    )
    with pytest.raises(HTTPException) as exc_info:
        await acquire_obo_token("sso-token")
    assert exc_info.value.status_code == status.HTTP_502_BAD_GATEWAY


# --- GraphClient ---


@pytest.mark.anyio
async def test_graph_client_get(mocker):
    response = httpx.Response(200, json={"displayName": "John"})
    mock_client = mocker.AsyncMock()
    mock_client.get.return_value = response
    mocker.patch(
        "xlwings_server.auth.entraid.obo.httpx.AsyncClient",
        return_value=mock_client,
    )
    async with GraphClient("test-token") as graph:
        result = await graph.get("/me")
    assert result.json() == {"displayName": "John"}


@pytest.mark.anyio
async def test_graph_client_post(mocker):
    response = httpx.Response(202)
    mock_client = mocker.AsyncMock()
    mock_client.post.return_value = response
    mocker.patch(
        "xlwings_server.auth.entraid.obo.httpx.AsyncClient",
        return_value=mock_client,
    )
    async with GraphClient("test-token") as graph:
        result = await graph.post("/me/sendMail", json={"message": {}})
    assert result.status_code == 202


@pytest.mark.anyio
async def test_graph_client_context_manager_closes(mocker):
    mock_client = mocker.AsyncMock()
    mocker.patch(
        "xlwings_server.auth.entraid.obo.httpx.AsyncClient",
        return_value=mock_client,
    )
    async with GraphClient("test-token"):
        pass
    mock_client.aclose.assert_awaited_once()


# --- get_graph_client ---


@pytest.mark.anyio
async def test_get_graph_client_no_sso_token():
    user = models.User(name="Test User")
    with pytest.raises(HTTPException) as exc_info:
        await get_graph_client(user)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "No SSO token" in exc_info.value.detail


@pytest.mark.anyio
async def test_get_graph_client_success(mock_settings, mock_obo_response):
    mock_obo_response()
    user = models.User(name="Test User", sso_token="sso-token")
    graph = await get_graph_client(user)
    assert isinstance(graph, GraphClient)


@pytest.mark.anyio
async def test_user_get_graph_client(mock_settings, mock_obo_response):
    mock_obo_response()
    user = models.User(name="Test User", sso_token="sso-token")
    graph = await user.get_graph_client()
    assert isinstance(graph, GraphClient)
