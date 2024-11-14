"""
- You can use pyscript.fetch, but often, you'll run into CORS issues (GitHub is fine though)
- No support for TCP/IP connections, i.e., no connections with external databases like Postgres
- No access to local file system, but there's a virtual file system where files can be created via URLs or via upload
- Check out https://docs.pyscript.net/2024.5.2/user-guide/workers/

TODO:
- make current_user optional
- look into toJS vs json (func vs script)
- .env file
- when changing body of custom function, the function seem to call a cached version?
- run 10000 custom functions
- remove CDNs
- automatic pyscript.json config?
- ObjectConverter
- static page CLI build command (code, meta, custom-scripts-sheet-buttons, etc.)
"""

import json
import os
from typing import Optional

os.environ["XLWINGS_LICENSE_KEY"] = "noncommercial"
import custom_functions
import custom_scripts
import xlwings as xw  # noqa: E402
from pydantic import BaseModel
from pyscript import window  # type: ignore # noqa: E402
from xlwings.server import (
    custom_functions_call as xlwings_custom_functions_call,
    custom_scripts_call as xlwings_custom_scripts_call,
)


async def custom_functions_call(data):
    current_user = User(id="n/a", name="Anonymous")
    data = json.loads(data)
    rv = xlwings_custom_functions_call(
        data, module=custom_functions, current_user=current_user
    )
    return rv


window.custom_functions_call = custom_functions_call


async def custom_scripts_call(data, script_name):
    book = xw.Book(json=json.loads(data))
    current_user = User(id="n/a", name="Anonymous")
    book = await xlwings_custom_scripts_call(
        module=custom_scripts,
        script_name=script_name,
        current_user=current_user,
        typehint_to_value={xw.Book: book},
    )
    return json.dumps(book.json())


window.custom_scripts_call = custom_scripts_call


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
