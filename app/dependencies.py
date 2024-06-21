from typing import Annotated

import xlwings as xw
from fastapi import Depends

from . import settings
from .auth import anonymous, entraid, models


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
if settings.entraid_tenant_id and settings.entraid_client_id:
    User = Annotated[models.User, Depends(entraid.get_user)]
    Admin = Annotated[models.User, Depends(entraid.get_admin)]
else:
    User = Annotated[models.User, Depends(anonymous.get_user)]
    Admin = Annotated[models.User, Depends(anonymous.get_user)]
