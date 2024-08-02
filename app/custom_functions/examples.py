"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import asyncio

import numpy as np
import pandas as pd
from xlwings import server
from xlwings.ext.sql import _sql

from .. import custom_scripts, utils


@server.func
def hello(name):
    """This is a normal custom function"""
    return f"Hello {name}!"


@server.func
async def hello_with_script(name):
    """This function triggers a custom script, requires XLWINGS_ENABLE_SOCKETIO=true"""
    await utils.trigger_script(custom_scripts.hello_world, exclude="Sheet2")
    return f"Hello {name}!"


@server.func
@server.arg("rows", doc="The number of rows in the returned array.")
@server.arg("cols", doc="The number of columns in the returned array.")
def standard_normal(rows, cols):
    """pandas: returns an array of standard normally distributed random numbers"""
    rng = np.random.default_rng()
    matrix = rng.standard_normal(size=(rows, cols))
    df = pd.DataFrame(matrix, columns=[f"col{i+1}" for i in range(matrix.shape[1])])
    return df


@server.func
@server.arg("df", pd.DataFrame, index=False)
def correl(df):
    """pandas: Like CORREL, but it works on whole matrices instead of just 2
    arrays.
    """
    return df.corr()


@server.func
@server.ret(object)
async def get_df(length=3):
    """Object handle: Returns an object handle to the Excel cell (requires
    XLWINGS_CACHE_URL for prod). You can supply `display_name` and `icon` keyword args
    with the ret decorator"""
    return pd.DataFrame({"one": [1] * length, "two": ["one"] * length})


@server.func
@server.arg("obj", object)
async def view(obj):
    """Object handle: This is how you can convert an object handle to cell values"""
    return obj


@server.func
async def clear_object_cache():
    """Object handle: Clear the object cache manually"""
    await utils.clear_object_cache()
    return "Object cache cleared"


@server.func
async def streaming_random(rows, cols):
    """Streaming function: must be provided as async generator,
    requires XLWINGS_ENABLE_SOCKETIO=true
    """
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
