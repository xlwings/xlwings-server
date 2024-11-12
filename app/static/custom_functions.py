from xlwings.ext.sql import _sql
from xlwings.server import arg, func


@func
async def hello(name):
    return f"hello from Python, {name}!"


@func
@arg("tables", expand="table", ndim=2)
def sql(query, *tables):
    return _sql(query, *tables)
