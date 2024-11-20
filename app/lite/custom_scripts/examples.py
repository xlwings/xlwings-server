try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None
import numpy as np
import xlwings as xw
from xlwings.server import script


@script(target_cell="[xlwings_button]Sheet1!B4", config={"exclude": "MySheet"})
def hello_world(book: xw.Book):
    sheet = book.sheets.active
    cell = sheet["A1"]
    if cell.value == "Hello xlwings!":
        cell.value = "Bye xlwings!"
    else:
        cell.value = "Hello xlwings!"


@script
def show_alert(book: xw.Book):
    book.app.alert("This is an alert!", title="xlwings Server Alert")


@script
def setup_custom_functions(book: xw.Book):
    prefix = "XLWINGS"
    prefix += "_DEV"
    sheet = book.sheets.add()
    sheet["A3"].value = f'={prefix}.HELLO("xlwings")'
    sheet["A5"].value = f"={prefix}.STANDARD_NORMAL(3, 4)"
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
    book.selection.select()


@script
def show_error(book: xw.Book):
    raise xw.XlwingsError("This would be your error message")
