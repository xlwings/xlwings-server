import datetime as dt
from pathlib import Path

import xlwings as xw
from dateutil import tz
from xlwings.server import script

this_dir = Path(__file__).resolve().parent


@script
def integration_test_write(book: xw.Book):
    assert (
        book.name == "integration_write.xlsm"
    ), "integration_write.xlsm must be the active file"
    sheet1 = book.sheets["Sheet 1"]

    # Values
    sheet1["E3"].value = [
        [None, "string"],
        [-1, 1],
        [-1.1, 1.1],
        [True, False],
        [
            dt.date(2021, 7, 1),
            dt.datetime(2021, 12, 31, 23, 35, 12, tzinfo=tz.gettz("Europe/Paris")),
        ],
    ]

    # Add sheets and write to them
    # NOTE: in Excel Online, adding/renaming sheets makes an alert impossible to quit
    # via provided buttons ("osfControl for the given ID doesn't exist.")
    sheet2 = book.sheets.add("New Named Sheet")
    sheet2["A1"].value = "Named Sheet"
    sheet3 = book.sheets.add()
    sheet3["A1"].value = "Unnamed Sheet"

    # Tables
    sheet_tables = book.sheets["Tables"]

    sheet_tables["A1"].value = [["one", "two"], [1, 2], [3, 4]]
    sheet_tables.tables.add(sheet3["A1:B3"])

    sheet_tables["A5"].value = [[1, 2], [3, 4]]
    sheet_tables.tables.add(sheet_tables["A5:B6"], has_headers=False)

    sheet_tables["A9"].value = [["one", "two"], [1, 2], [3, 4]]
    mytable1 = sheet_tables.tables.add(sheet_tables["A9:B11"], name="MyTable1")
    mytable1.show_autofilter = False

    sheet_tables["A13"].value = [[1, 2], [3, 4]]
    mytable2 = sheet_tables.tables.add(
        sheet_tables["A13:B14"], name="MyTable2", has_headers=False
    )
    mytable2.show_headers = False
    mytable2.show_totals = True
    mytable2.show_filters = False
    mytable2.resize(sheet_tables["A14:C17"])

    # Set sheet name
    book.sheets["Sheet2"].name = "Changed"
    book.sheets["Changed"]["A1"].value = "Changed"

    # Autofit
    autofit_sheet = book.sheets["Autofit"]
    autofit_sheet["A1"].value = [[1, 2], [3, 4]]
    autofit_sheet["A1:B2"].autofit()
    autofit_sheet["D4:E5"].rows.autofit()
    autofit_sheet["G7:H82"].columns.autofit()

    # Range color
    sheet1["E12:F12"].color = "#3DBAC1"

    # Add Hyperlink
    sheet1["E14"].add_hyperlink("https://www.xlwings.org", "xlwings", "xw homepage")

    # Number format
    sheet1["E9:F10"].value = [[1, 2], [3, 4]]
    sheet1["E9:F10"].number_format = "0%"

    # Clear contents
    sheet1["E16:F17"].clear_contents()

    # Activate sheet
    book.sheets[1].activate()

    picture_dir = this_dir.parent / "app" / "static" / "images" / "ribbon" / "examples"
    # Pictures
    sheet1.pictures.add(
        picture_dir / "xlwings-32.png",
        name="MyPic",
        anchor=sheet1["C28"],
    )
    sheet1.pictures.add(picture_dir / "xlwings-80.png", name="MyPic", update=True)
    book.sheets[1].pictures.add(picture_dir / "xlwings-32.png")

    # Add named ranges
    book.names.add("test1", "='Sheet 1'!$A$1:$B$3")
    book.names.add("test2", "=Changed!$A$1")
    sheet1["A1"].name = "test3"
    sheet1.names.add("test4", "='Sheet 1'!$A$1:$B$3")

    # Delete named ranges
    book.names["DeleteMe"].delete()
    book.names["Sheet4!DeleteMe"].delete()
    book.names["'Sheet 3'!DeleteMe"].delete()
