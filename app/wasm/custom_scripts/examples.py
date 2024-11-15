# To use matplotlib, add it to pyscript.json
# import matplotlib as mpl
# import matplotlib.pyplot as plt
import xlwings as xw
from xlwings.server import script

# mpl.use("agg")


@script(target_cell="[xlwings_button]Sheet1!B4", config={"exclude": "MySheet"})
async def test(book: xw.Book):
    sheet = book.sheets[0]
    sheet["A15"].value = sheet["A10"].expand().value

    # fig = plt.figure()
    # plt.plot([1, 2, 3])
    # sheet1.pictures.add(fig, name="MyPlot", update=True, anchor=sheet1["C5"])
    # sheet1["A1"].select()
