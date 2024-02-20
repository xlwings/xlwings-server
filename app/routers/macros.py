import logging

from fastapi import APIRouter, Depends

from ..auth.entraid import User, get_user
from ..utils import Book

logger = logging.getLogger(__name__)


# Adding the dependencies to the router makes sure that all endpoints are protected in
# this module. If you need access to the user in the endpoints, you'll need to add the
# dependency again to the endpoint (see hello).
router = APIRouter(dependencies=[Depends(get_user)])


@router.post("/hello")
async def hello(book: Book, current_user: User = Depends(get_user)):
    logger.info(f"hello called by {current_user.name}")
    sheet = book.sheets[0]
    cell = sheet["A1"]
    if cell.value == "Hello xlwings!":
        cell.value = "Bye xlwings!"
    else:
        cell.value = "Hello xlwings!"

    return book.json()
