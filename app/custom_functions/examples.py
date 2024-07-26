"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import asyncio

import numpy as np
import pandas as pd
from xlwings import server
from xlwings.conversion import Converter
from xlwings.ext.sql import _sql

from .. import custom_scripts, object_handles
from ..utils import trigger_script

# TODOs
# optional redis connection handling
# 1-worker handling in memory
# caller address
# cache key
# accept a BOOK_ID from xlwings.conf sheet to make cache keys unique
# allow to clear the cache manually, via expireat, (when workbook is closed everywhere)
# xw.object
# compression?
# Refactor so you can provide own serializer/deserializer


class ObjectCache(Converter):
    @staticmethod
    def read_value(values, options):
        obj = object_handles.deserialize(object_handles.r.get("mykey").decode())
        return obj

    @staticmethod
    def write_value(obj, options):
        values = object_handles.serialize(obj)
        object_handles.r.set("mykey", values)
        return {
            "type": "Entity",
            "text": options.get("display_name", obj.__class__.__name__),
            # "properties": {"id": {"type": "String", "basicValue": "xxxxx"}},
            "layouts": {"compact": {"icon": options.get("icon", "Generic")}},
        }


ObjectCache.register("object")


@server.func
@server.arg("df", "object")
@server.ret(index=False)
def get_object(df):
    return df


@server.func
@server.arg("x", pd.DataFrame, index=False, parse_dates=["three"])
@server.ret("object")
def set_object(x):
    return x


@server.func
def hello(name):
    """This is a normal custom function"""
    return f"Hello {name}!"


@server.func
async def hello_with_script(name):
    """This function triggers a custom script, requires XLWINGS_ENABLE_SOCKETIO=true"""
    await trigger_script(custom_scripts.hello_world, exclude="Sheet2")
    return f"Hello {name}!"


@server.func
async def streaming_random(rows, cols):
    """This is a streaming function and must be provided as async generator,
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
