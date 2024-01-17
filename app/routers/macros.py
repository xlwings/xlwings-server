from fastapi import APIRouter

from ..utils import Book

router = APIRouter()


@router.post("/hello")
async def hello(book: Book):
    sheet = book.sheets[0]
    cell = sheet["A1"]
    if cell.value == "Hello xlwings!":
        cell.value = "Bye xlwings!"
    else:
        cell.value = "Hello xlwings!"

    return book.json()
