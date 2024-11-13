import random

# To use matplotlib, add it to pyscript.json
# import matplotlib as mpl
# import matplotlib.pyplot as plt
import xlwings as xw
from xlwings.server import script

# mpl.use("agg")


@script
async def test(book: xw.Book):
    sheet1 = book.sheets[0]
    print(sheet1["A1:A2"].value)
    book.sheets[0]["A3"].value = random.random()

    # fig = plt.figure()
    # plt.plot([1, 2, 3])
    # sheet1.pictures.add(fig, name="MyPlot", update=True, anchor=sheet1["C5"])
    # sheet1["A1"].select()
