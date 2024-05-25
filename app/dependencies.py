from typing import Annotated

import xlwings as xw
from fastapi import Depends

from .auth import entraid
from .auth.entraid import get_admin, get_user


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
User = Annotated[entraid.User, Depends(get_user)]
Admin = Annotated[entraid.User, Depends(get_admin)]
