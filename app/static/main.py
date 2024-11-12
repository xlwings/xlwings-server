"""
- You can use pyscript.fetch, but often, you'll run into CORS issues (GitHub is fine though)
- No support for TCP/IP connections, i.e., no connections with external databases like Postgres
- No access to local file system, but there's a virtual file system where files can be created via URLs or via upload
- Check out https://docs.pyscript.net/2024.5.2/user-guide/workers/

TODO:
- make current_user optional
"""

import json
import os
from typing import Optional

os.environ["XLWINGS_LICENSE_KEY"] = "noncommercial"
# To use matplotlib, add it to pyscript.json
# import matplotlib as mpl
# import matplotlib.pyplot as plt
# mpl.use("agg")
import custom_functions
import xlwings as xw  # noqa: E402
from pydantic import BaseModel
from pyscript import window  # noqa: E402
from xlwings.server import (
    custom_functions_call as xlwings_custom_functions_call,
)

xwjs = window.xlwings


async def custom_functions_call(data):
    current_user = User(id="n/a", name="Anonymous")
    data = json.loads(data)
    rv = xlwings_custom_functions_call(
        data, module=custom_functions, current_user=current_user
    )
    return rv


window.custom_functions_call = custom_functions_call


async def test(event):
    """Called from task pane button"""
    # Instantiate Book hack
    data = await xwjs.getBookData()
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
    xwjs.runActions(json.dumps(book.json()))


class User(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    domain: Optional[str] = None
    roles: Optional[list[str]] = []

    async def has_required_roles(self, required_roles: Optional[list[str]] = None):
        if required_roles:
            if set(required_roles).issubset(self.roles):
                return True
            else:
                return False
        else:
            return True

    async def is_authorized(self):
        """Here, you can implement a custom authorization logic"""
        return True
