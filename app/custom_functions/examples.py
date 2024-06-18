"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import asyncio

import numpy as np
import pandas as pd
from xlwings import server
from xlwings.ext.sql import _sql

from ..custom_scripts import hello_world
from ..utils import trigger_script


@server.func
def hello(name):
    """This is a normal custom function"""
    return f"Hello {name}!"


@server.func
async def hello_with_script(name):
    """This function triggers a custom script (requires XLWINGS_ENABLE_SOCKETIO=true)"""
    await trigger_script(hello_world, exclude="Sheet2")
    return f"Hello {name}!"


@server.func
async def streaming_random(rows, cols):
    """This is a streaming function and must be provided as async generator"""
    rng = np.random.default_rng()
    while True:
        matrix = rng.standard_normal(size=(rows, cols))
        df = pd.DataFrame(matrix, columns=[f"col{i+1}" for i in range(matrix.shape[1])])
        yield df
        await asyncio.sleep(1)


@server.func
@server.arg("tables", expand="table", ndim=2)
def sql(query, *tables):
    """In-Excel SQL
    see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql"""
    return _sql(query, *tables)
