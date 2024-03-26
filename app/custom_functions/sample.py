import asyncio

import numpy as np
import pandas as pd
from xlwings import server


@server.func
def hello(name):
    """This is a normal custom function"""
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
