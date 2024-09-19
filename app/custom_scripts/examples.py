"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import xlwings as xw
from xlwings.server import script

from ..config import settings


@script
def hello_world(book: xw.Book):
    sheet = book.sheets.active
    cell = sheet["A1"]
    if cell.value == "Hello xlwings!":
        cell.value = "Bye xlwings!"
    else:
        cell.value = "Hello xlwings!"


@script
def setup_custom_functions(book: xw.Book):
    prefix = f"{settings.functions_namespace}"
    if settings.environment != "prod":
        prefix += f"_{settings.environment}"
    sheet = book.sheets.add()
    sheet["A1"].value = f'={prefix}.HELLO("xlwings")'
    sheet["A3"].value = f"={prefix}.STANDARD_NORMAL(3, 4)"
    sheet["A8"].value = f"={prefix}.CORREL(A3#)"
    sheet["A14"].value = f"={prefix}.TO_DF(A3#)"
    sheet["A16"].value = f"={prefix}.GET_HEALTHEXP()"
    sheet[
        "A18"
    ].value = f"""={prefix}.DF_QUERY(A16, "Country == 'Japan' and Year > 2017")"""
    sheet["A23"].value = f"={prefix}.VIEW(A16, 3)"
    sheet["A28"].value = f"={prefix}.STREAMING_RANDOM(3, 4)"
    sheet["A33"].value = f"={prefix}.GET_CURRENT_USER()"
    sheet[
        "A35"
    ].value = (
        f'={prefix}.SQL("SELECT Year, Country FROM a WHERE Spending_USD < 4600", A18#)'
    )
    sheet["A37"].value = f'={prefix}.HELLO_WITH_SCRIPT("xlwings")'
    sheet.activate()
