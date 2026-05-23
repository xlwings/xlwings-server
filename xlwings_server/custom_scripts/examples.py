"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None
import sys
from pathlib import Path

import numpy as np
import xlwings as xw
from xlwings.server import script

from . import settings


@script
def hello_world(book: xw.Book):
    sheet = book.sheets.active
    cell = sheet["A1"]
    if cell.value == "Hello package!":
        cell.value = "Bye package!"
    else:
        cell.value = "Hello package!"


@script
def show_alert(book: xw.Book):
    # callback is optional and only required if you want a JS function to be called
    # when clicking a button. alertCallback is defined in app/static/js/core/examples.js
    book.app.alert(
        "This is an alert!",
        title="xlwings Server Alert",
        buttons="ok_cancel",
        callback="alertCallback",
    )


@script
def setup_custom_functions(book: xw.Book):
    prefix = f"{settings.functions_namespace}"
    if settings.environment != "prod":
        prefix += f"_{settings.environment}".upper()
    sheet = book.sheets.add()
    sheet["A3"].value = f'={prefix}.HELLO("xlwings")'
    sheet["A5"].value = f"={prefix}.STANDARD_NORMAL(3, 4)"
    sheet["A10"].value = f"={prefix}.CORREL(A5#)"
    if not settings.enable_wasm:
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
        ].value = f'={prefix}.SQL("SELECT Year, Country FROM a WHERE Spending_USD < 4600", A20#)'
        sheet["A40"].value = f'={prefix}.HELLO_WITH_SCRIPT("xlwings")'
    sheet.activate()


@script
def show_plot(book: xw.Book):
    """Adopted from
    https://matplotlib.org/stable/plot_types/stats/hexbin.html#sphx-glr-plot-types-stats-hexbin-py
    """
    if not plt:
        raise xw.XlwingsError("You need to install Matplotlib for this example")
    plt.style.use("_mpl-gallery-nogrid")
    rng = np.random.default_rng()
    x = rng.standard_normal(5000)
    y = 1.2 * x + rng.standard_normal(5000) / 3
    fig, ax = plt.subplots()
    ax.hexbin(x, y, gridsize=20)
    ax.set(xlim=(-2, 2), ylim=(-3, 3))
    book.sheets.active.pictures.add(
        fig, anchor=book.sheets.active["A10"], update=True, name="mplot"
    )


@script
def show_error(book: xw.Book):
    raise xw.XlwingsError("This would be your error message")


# Unit tests
if settings.enable_tests:
    sys.path.append(str(Path(__file__).parent.parent.resolve()))
    from tests.e2e_custom_scripts import *
