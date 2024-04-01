from typing import Annotated

import xlwings as xw
from fastapi import Depends
from jinja2_fragments.fastapi import Jinja2Blocks

from . import settings

# Templates
templates = Jinja2Blocks(
    directory=settings.base_dir / "templates",
    trim_blocks=True,
    lstrip_blocks=True,
)


# Book dependency
def get_book(body: dict):
    """Dependency that returns the calling book and cleans it up again"""
    book = xw.Book(json=body)
    try:
        yield book
    finally:
        book.close()


# This is the type annotation that we're using in the endpoints
Book = Annotated[xw.Book, Depends(get_book)]
