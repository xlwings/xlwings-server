"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import xlwings as xw
from xlwings.server import script

from ..config import settings


@script(target_cell="[xlwings_button]Sheet1!B4")
def hello_world(book: xw.Book):
    import time

    time.sleep(2)
    print("xxxxxxxxxxxxxxxxxxxxxxxx")
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
    sheet["A3"].value = f'={prefix}.HELLO("xlwings")'
    sheet["A5"].value = f"={prefix}.STANDARD_NORMAL(3, 4)"
    sheet["A10"].value = f"={prefix}.CORREL(A5#)"
    sheet["A16"].value = f"={prefix}.TO_DF(A5#)"
    sheet["A18"].value = f"={prefix}.GET_HEALTHEXP()"
    sheet[
        "A20"
    ].value = f"""={prefix}.DF_QUERY(A18, "Country == 'Japan' and Year > 2017")"""
    sheet["A25"].value = f"={prefix}.VIEW(A18, 3)"
    sheet["A30"].value = f"={prefix}.STREAMING_RANDOM(3, 4)"
    sheet["A35"].value = f"={prefix}.GET_CURRENT_USER()"
    sheet[
        "A37"
    ].value = (
        f'={prefix}.SQL("SELECT Year, Country FROM a WHERE Spending_USD < 4600", A20#)'
    )
    sheet["A40"].value = f'={prefix}.HELLO_WITH_SCRIPT("xlwings")'
    sheet.activate()
