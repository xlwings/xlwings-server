import importlib
import logging
from typing import Annotated, Union

import xlwings as xw
from fastapi import Depends, Header, HTTPException, status

from .auth import models
from .config import settings

logger = logging.getLogger(__name__)


# Book
def get_book(body: dict):
    """Book dependency that returns the calling book and cleans it up again"""
    book = xw.Book(json=body)
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
    try:
        module = importlib.import_module(f"app.auth.{provider}")
        current_user = await module.validate_token(token_string)
    except (AttributeError, ModuleNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auth provider '{provider}' implementation missing.",
        )
    return current_user


class Authorizer:
    """This class can be used to create dependencies that require specific roles:

    get_specific_user = Authorizer(roles=["role1", "role2"])

    Returns a user object.
    """

    def __init__(self, required_roles: list = None):
        self.required_roles = required_roles

    async def __call__(self, current_user: models.User = Depends(authenticate)):
        if not settings.auth_providers:
            return current_user
        # RBAC
        has_required_roles = await current_user.has_required_roles(self.required_roles)
        if not has_required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Auth error: Missing roles for {current_user.name}: {', '.join(set(self.required_roles).difference(current_user.roles))}",
            )
        # Authorization
        if not await current_user.is_authorized():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Auth error: Not authorized.",
            )
        return current_user


get_user = Authorizer(required_roles=settings.auth_required_roles)


User = Annotated[models.User, Depends(get_user)]
