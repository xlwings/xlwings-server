"""
* You can use pyscript.fetch, but often, you'll run into CORS issues (GitHub is fine though)
* No support for TCP/IP connections, i.e., no connections with external databases like Postgres
* No access to local file system, but there's a virtual file system where files can be created via URLs or via upload
* Check out https://docs.pyscript.net/2024.5.2/user-guide/workers/
"""

import json
import os
import sqlite3

# To use matplotlib, add it to pyscript.json
# import matplotlib as mpl
# import matplotlib.pyplot as plt
# mpl.use("agg")

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

    # fig = plt.figure()
    # plt.plot([1, 2, 3])
    # sheet1.pictures.add(fig, name="MyPlot", update=True, anchor=sheet1["C5"])
    # sheet1["A1"].select()

    # Process actions (this could be improved so methods are applied immediately)
    xwjs.runActionsStandalone(json.dumps(book.json()))


async def hello(name):
    """Used as custom function (a.k.a. UDF)"""
    return [[f"hello from Python, {name}!"]]


window.hello = hello


# @func
# @arg("tables", expand="table", ndim=2)
async def sql(query, *tables):
    print("xx", query)
    query = json.loads(query)[0][0]
    print("yy", tables)
    processed_tables = [
        json.loads(table) if isinstance(table, str) else table
        for table in tables  # TODO: remove ending [0] when converter applied
    ]
    print("zz", processed_tables)
    res = _sql(query, *processed_tables)
    print("rr", res)
    return res


window.sql = sql


def conv_value(value, col_is_str):
    if value is None:
        return "NULL"
    if col_is_str:
        return repr(str(value))
    elif isinstance(value, bool):
        return 1 if value else 0
    else:
        return repr(value)


def _sql(query, *tables):
    conn = sqlite3.connect(":memory:")
    print("t", tables)

    c = conn.cursor()
    for i, table in enumerate(tables):
        # TODO: remove [0] in next 2 rows
        cols = table[0][0]
        rows = table[0][1:]
        print(cols)
        print(rows)
        types = [any(isinstance(row[j], str) for row in rows) for j in range(len(cols))]
        name = chr(65 + i)

        stmt = "CREATE TABLE %s (%s)" % (
            name,
            ", ".join(
                "'%s' %s" % (col, "STRING" if typ else "REAL")
                for col, typ in zip(cols, types)
            ),
        )
        c.execute(stmt)

        if rows:
            stmt = "INSERT INTO %s VALUES %s" % (
                name,
                ", ".join(
                    "(%s)"
                    % ", ".join(
                        conv_value(value, type) for value, typ in zip(row, types)
                    )
                    for row in rows
                ),
            )
            # Fixes values like these:
            # sql('SELECT a FROM a', [['a', 'b'], ["""X"Y'Z""", 'd']])
            stmt = stmt.replace("\\'", "''")
            c.execute(stmt)

    res = []
    c.execute(query)
    res.append([x[0] for x in c.description])
    for row in c:
        res.append(list(row))
    print("marker3")
    print(res)
    print(type(res))

    return res
