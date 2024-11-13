from typing import Annotated

import numpy as np
import pandas as pd
from xlwings.ext.sql import _sql
from xlwings.server import arg, func, ret


# 1) This is the most basic custom function -- it only requires the @func decorator.
@func
def hello(name):
    return f"Hello {name} from WASM!"


# 2) Returning a pandas DataFrame and function documentation
# The function's doc string will turn up in the Function Wizard together with the
# doc strings from the arg decorators. The sample also shows how to suppress the index
# of a DataFrame via the ret decorator.
@func
@arg("rows", doc="The number of rows in the returned array.")
@arg("cols", doc="The number of columns in the returned array.")
@ret(index=False)
def standard_normal(rows, cols):
    """Returns an array of standard normally distributed pseudo random numbers"""
    rng = np.random.default_rng()
    matrix = rng.standard_normal(size=(rows, cols))
    df = pd.DataFrame(matrix, columns=[f"col{i+1}" for i in range(matrix.shape[1])])
    return df


# 3) Reading a pandas DataFrames
@func
@arg("df", pd.DataFrame, index=False)
def correl(df):
    """Like CORREL, but it works on whole matrices instead of just 2 arrays."""
    return df.corr()


# 4) Type hints: this is the same example as 3), but using type hints instead of
# decorators. You could also use type hints and decorators together. In this sample, we
# are storing the Annotated type hint outside of the function, so it is easy to reuse.
Df = Annotated[pd.DataFrame, {"index": False}]


@func
def correl2(df: Df):
    """Like CORREL, but it works on whole matrices instead of just 2 arrays."""
    return df.corr()


# 13) In-Excel SQL: query Excel ranges/tables via SQL (SQLite dialect)
@func
@arg("tables", expand="table", ndim=2)
def sql(query, *tables):
    """In-Excel SQL
    see: https://docs.xlwings.org/en/latest/extensions.html#in-excel-sql"""
    return _sql(query, *tables)
