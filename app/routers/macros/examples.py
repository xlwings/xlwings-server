"""
Make sure to import the module under __init__.py, e.g.:
from . import examples
"""

import logging

from ... import dependencies as dep
from .router import router

logger = logging.getLogger(__name__)


@router.post("/hello")
async def hello(book: dep.Book, current_user: dep.User):
    logger.info(f"hello called by {current_user.name}")
    sheet = book.sheets[0]
    cell = sheet["A1"]
    if cell.value == "Hello xlwings!":
        cell.value = "Bye xlwings!"
    else:
        cell.value = "Hello xlwings!"

    return book.json()
