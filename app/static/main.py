"""
* You can use pyscript.fetch, but often, you'll run into CORS issues (GitHub is fine though)
* No support for TCP/IP connections, i.e., no connections with external databases like Postgres
* No access to local file system, but there's a virtual file system where files can be created via URLs or via upload
* Check out https://docs.pyscript.net/2024.5.2/user-guide/workers/
"""

import json
import os

import matplotlib as mpl
import matplotlib.pyplot as plt

mpl.use("agg")

os.environ["XLWINGS_LICENSE_KEY"] = "noncommercial"
import xlwings as xw  # noqa: E402
from pyscript import window  # noqa: E402

xwjs = window.xlwings


async def test(event):
    """Called from task pane button"""
    # Instantiate Book hack
    data = await xwjs.getBookDataStandalone()
    book = xw.Book(json=json.loads(data))

    # Usual xlwings API
    sheet1 = book.sheets[0]
    print(sheet1["A1:A2"].value)
    book.sheets[0]["A3"].value = "xxxxxxx"

    fig = plt.figure()
    plt.plot([1, 2, 3])
    sheet1.pictures.add(fig, name="MyPlot", update=True, anchor=sheet1["C5"])
    sheet1["A1"].select()

    # Process actions (this could be improved so methods are applied immediately)
    xwjs.runActionsStandalone(json.dumps(book.json()))


async def hello(name):
    """Used as custom function (a.k.a. UDF)"""
    return [[f"hello from Python, {name}!"]]


window.hello = hello
