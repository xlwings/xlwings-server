import logging
from typing import Annotated

import xlwings as xw
from fastapi import Depends, Header, HTTPException, status

from .auth import anonymous, entraid, models
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
def authorize(user: models.User, roles: list = None):
    # TODO: move to user model
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
    if settings.entraid_tenant_id or settings.entraid_client_id:
        return await entraid.validate_token(token_string)
    else:
        return await anonymous.validate_token(token_string)


class Authorizer:
    """This class can be used to create dependencies that require specific roles:

    get_specific_user = Authorizer(roles=["role1", "role2"])

    Returns a user object.
    """

    def __init__(self, roles: list = None):
        self.roles = roles

    def __call__(self, current_user: models.User = Depends(authenticate)):
        return authorize(current_user, self.roles)


# Dependencies for RBAC
get_user = Authorizer()
get_admin = Authorizer(roles=["admin"])


User = Annotated[models.User, Depends(get_user)]
