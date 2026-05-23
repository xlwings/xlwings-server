import importlib
import json
import logging
from typing import Annotated, Union

import redis
import xlwings as xw
from fastapi import Depends, Form, Header, HTTPException, Request, status

from . import models
from .config import settings
from .databases import get_redis_client

logger = logging.getLogger(__name__)


# Book
async def parse_book_input(
    request: Request,
    form_data: str | None = Form(None, alias="bookData"),
) -> dict:
    """Helper dependency to parse either form data (htmx)
    or body (custom scripts & custom functions) -- couldn't make Body() work"""
    if form_data:
        return json.loads(form_data)
    else:
        body_bytes = await request.body()
        if body_bytes:
            body_str = body_bytes.decode("utf-8")
            return json.loads(body_str)
    raise HTTPException(status_code=400, detail="No book data provided")


async def get_book(book_data: dict = Depends(parse_book_input)):
    """Book dependency that returns the calling book and cleans it up again"""
    book = xw.Book(json=book_data)
    try:
        yield book
    finally:
        book.close()


Book = Annotated[xw.Book, Depends(get_book)]


# Users/Auth
async def authenticate(
    token_string: str = Header(default="", alias="Authorization"),
    auth_provider: Union[str, None] = Header(default=None),
):
    if not settings.auth_providers:
        return User(id="n/a", name="Anonymous")
    if len(settings.auth_providers) == 1:
        provider = settings.auth_providers[0]
    elif len(settings.auth_providers) > 1 and not auth_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="With multiple auth providers, you need to provide the Auth-Provider header.",
        )
    elif auth_provider not in settings.auth_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auth-Provider header wasn't found in XLWINGS_AUTH_PROVIDERS setting.",
        )
    else:
        provider = auth_provider
    logger.info(f"Using auth provider {provider}")
    # Validate the provider before import to prevent non-literal-import SAST flagging
    if provider not in settings.auth_providers:
        raise ValueError(f"Unsupported authentication provider: {provider}")
    try:
        # Try to import from project directory first (user override)
        try:
            module = importlib.import_module(f"auth.{provider}")
        except ModuleNotFoundError:
            # Fall back to package location (default implementation)
            module = importlib.import_module(f"xlwings_server.auth.{provider}")
        current_user = await module.validate_token(token_string)
    except (AttributeError, ModuleNotFoundError):
        logger.exception(f"Auth provider '{provider}' implementation missing.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auth provider '{provider}' implementation missing.",
        )
    return current_user


async def get_user(request: Request, current_user: models.User = Depends(authenticate)):
    # Extract IP address and attach it to the user object
    if "x-forwarded-for" in request.headers:
        ip_address = request.headers["x-forwarded-for"].split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else None
    current_user.ip_address = ip_address

    if not settings.auth_providers:
        return current_user
    # RBAC
    has_required_roles = await current_user.has_required_roles(
        settings.auth_required_roles
    )
    if not has_required_roles:
        missing_roles = ", ".join(
            set(settings.auth_required_roles).difference(current_user.roles)
        )
        msg = f"Auth error: Missing roles for {current_user.name}: {missing_roles}"
        logger.warning(msg)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=msg,
        )
    # Authorization
    if not await current_user.is_authorized():
        msg = f"Auth error: Not authorized for {current_user.name}"
        logger.warning(msg)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=msg,
        )
    return current_user


User = Annotated[models.User, Depends(get_user)]

# Redis
RedisClient = Annotated[redis.Redis, Depends(get_redis_client)]
