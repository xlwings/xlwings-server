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
async def authenticate(token_string: str = Header(default="", alias="Authorization")):
    if settings.entraid_tenant_id or settings.entraid_client_id:
        current_user = await entraid.validate_token(token_string)
        return current_user
    else:
        current_user = await anonymous.validate_token(token_string)
        return current_user


class Authorizer:
    """This class can be used to create dependencies that require specific roles:

    get_specific_user = Authorizer(roles=["role1", "role2"])

    Returns a user object.
    """

    def __init__(self, roles: list = None):
        self.roles = roles

    def __call__(self, current_user: models.User = Depends(authenticate)):
        is_authorized, message = current_user.authorize(self.roles)
        if not is_authorized:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)
        return current_user


get_user = Authorizer()
get_admin = Authorizer(roles=["admin"])


User = Annotated[models.User, Depends(get_user)]
Admin = Annotated[models.User, Depends(get_admin)]
