"""
Make sure to import the desired functions under __init__.py, e.g.:
from .example import *
"""

import asyncio
import datetime as dt
import sys
from pathlib import Path
from typing import Annotated

import numpy as np
import pandas as pd
from xlwings.server import arg, func, ret

from . import settings

if not settings.enable_lite:
    from xlwings.constants import ObjectHandleIcons
    from xlwings.ext.sql import _sql

    from .. import custom_scripts, utils
    from ..models import CurrentUser


# 1) This is the most basic custom function -- it only requires the @func decorator.
@func
def hello(name):
    return f"Hello {name}!"


# 2) Returning a pandas DataFrame and function documentation
# The function's doc string will turn up in the Function Wizard together with the
# doc strings from the arg decorators. The sample also shows how to suppress the index
# of a DataFrame via the ret decorator.
@func
@arg("rows", doc="The number of rows in the returned array.")
@arg("cols", doc="The number of columns in the returned array.")
def standard_normal(rows, cols):
    """Returns an array of standard normally distributed pseudo random numbers"""
    rng = np.random.default_rng()
    matrix = rng.standard_normal(size=(rows, cols))
    date_rng = pd.date_range(start=dt.datetime(2025, 6, 15), periods=rows, freq="D")
    df = pd.DataFrame(
        matrix, columns=[f"col{i+1}" for i in range(matrix.shape[1])], index=date_rng
    )
    return df


# 3) Reading a pandas DataFrames
@func
@arg("df", pd.DataFrame)
def correl(df):
    """Like CORREL, but it works on whole matrices instead of just 2 arrays."""
    return df.corr()


# 4) Type hints: this is the same example as 3), but using type hints instead of
# decorators. You could also use type hints and decorators together. In this sample, we
# are storing the Annotated type hint outside of the function, so it is easy to reuse.
Df = Annotated[pd.DataFrame, {"index": True}]


@func
def correl2(df: Df):
    """Like CORREL, but it works on whole matrices instead of just 2 arrays."""
    return df.corr()


if not settings.enable_lite:
    # 5) Object handles: This returns an object handle to a DataFrame that is generated on
    # the backend. You can change the `text` and `icon` via annotated type hint or via ret
    # decorator.
    @func
    async def get_df() -> object:
        """Returns an object handle to the Excel cell (for production, this requires
        XLWINGS_OBJECT_CACHE_URL)."""
        return pd.DataFrame(
            {"A": [1, 2, 3, 4, 5], "B": [10, 8, 6, 4, 2], "C": [10, 9, 8, 7, 6]}
        )

    # 6) Object handles: demonstrating the use of the "icon" and "text" options. Instead
    # of using the ret decorator, you could also use an annotated type hint like so:
    # -> Annotated[object, {"icon": ObjectHandleIcons.table, "text": "healthexp"}]
    @func
    @ret(icon=ObjectHandleIcons.table, text="healthexp")
    async def get_healthexp(
        csv_url="https://raw.githubusercontent.com/mwaskom/seaborn-data/master/healthexp.csv",
    ) -> object:
        """Returns an object handle to the Excel cell (for production, this requires
        XLWINGS_OBJECT_CACHE_URL)."""
        return pd.read_csv(csv_url)

    # 7) Object handles: turn an Excel range into a DataFrame object handle. Using an Excel
    # table as source makes it easy to work with dynamic source ranges. This sample reuses
    # the Df type hint from above to set index=False.
    @func
    async def to_df(df: Df) -> object:
        return df

    # 8) Object handles: use a pandas DataFrame query by providing a DataFrame via object
    # handle and the query as string: [NAMESPACE].DF_QUERY(A1, "A > B")
    @func
    async def df_query(df: object, query: str) -> Df:
        return df.query(query)

    # 9) Object handles: Generic function that turns an object handle into Excel values
    @func
    async def view(obj: object, head=None):
        """Converts an object handle to cell values. `head` can be TRUE or an integer, which
        represents the number of rows from the top that you want to see. TRUE returns the
        first 5 rows.
        """
        if head and isinstance(head, bool):
            head = 5
        if isinstance(obj, pd.DataFrame) and head:
            return obj.iloc[:head, :]
        elif isinstance(obj, (list, tuple, np.ndarray)) and head:
            return obj[:head]
        else:
            return obj

    # 10) Object handles: Clear the object cache manually
    @func
    async def clear_object_cache():
        """Object handle: Clear the object cache manually"""
        await utils.clear_object_cache()
        return "Object cache cleared"

    # 11) Streaming functions (the modern version of RTD functions)
    @func
    async def streaming_random(rows, cols):
        """Streaming function: must be provided as async generator,
        requires XLWINGS_ENABLE_SOCKETIO=true
        """
        rng = np.random.default_rng()
        while True:
            matrix = rng.standard_normal(size=(rows, cols))
            df = pd.DataFrame(
                matrix, columns=[f"col{i+1}" for i in range(matrix.shape[1])]
            )
            yield df
            await asyncio.sleep(1)

    # 12) To access the current user object, simply add an argument with the CurrentUser
    # type hint
    @func
    def get_current_user(current_user: CurrentUser):
        return f"{current_user}"

    # 13) In-Excel SQL: query Excel ranges/tables via SQL (SQLite dialect)
    @func
    @arg("tables", expand="table", ndim=2)
    def sql(query, *tables):
        """In-Excel SQL
        see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql"""
        return _sql(query, *tables)

    # 14) Custom functions with side effects (experimental)
    @func
    async def hello_with_script(name):
        """This function triggers a custom script, requires XLWINGS_ENABLE_SOCKETIO=true"""
        await utils.trigger_script(custom_scripts.hello_world, exclude="MySheet")
        return f"Hello {name}!"


# Unit tests
if settings.enable_tests:
    sys.path.append(str(Path(__file__).parent.parent.resolve()))
    from tests.e2e_custom_functions import *
