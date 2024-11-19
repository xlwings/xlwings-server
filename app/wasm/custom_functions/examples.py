import numpy as np
import pandas as pd
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
