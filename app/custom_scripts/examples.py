"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import xlwings as xw
from xlwings.server import script


@script
def hello_world(book: xw.Book):
    sheet = book.sheets[0]
    cell = sheet["A1"]
    if cell.value == "Hello xlwings!":
        cell.value = "Bye xlwings!"
    else:
        cell.value = "Hello xlwings!"
