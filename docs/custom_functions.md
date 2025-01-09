# Custom Functions

This tutorial teaches you everything about custom functions. Note that custom functions are only supported with Office.js add-ins.

## Basic syntax

As you can see in the [examples](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions/examples.py), the simplest custom function only requires the `@func` decorator:

```python
from xlwings.server import func

@func
def hello(name):
    return f"Hello {name}!"
```

```{note}
- The `func` decorator is imported from `xlwings.server` rather than `xlwings`.
- While it's ok to edit the functions in `examples.py` to try things out, you shouldn't commit the changes to Git to prevent future merge conflicts. Rather, create a new Python module as explained in the next section.
```

## Adding new custom functions

Here is how you can write your own custom functions:

1. Add a Python module under [`app/custom_functions`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions), e.g., `myfunctions.py`.
2. Add the following import statement (highlighted line) to [`app/custom_functions/__init__.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions/__init__.py):

```{code-block} python
:emphasize-lines: 6

from ..config import settings

if settings.enable_examples:
    from .examples import *

from .myfunctions import *
```

```{note}
During development, changes to the functions will be automatically reloaded in Excel. However, in production, if your changes include adding/deleting functions or editing the function arguments, you will need to restart Excel. A restart is not required if you're just editing the body of an existing function.
```

## pandas DataFrames

By using the `@arg` and `@ret` decorators, you can apply converters and options to arguments and the return value, respectively.

For example, to read in the values of a range as pandas DataFrame and return the correlations without writing out the header and the index, you would write:

```python
import pandas as pd
from xlwings.server import func, arg, ret

@func
@arg("df", pd.DataFrame, index=False, header=False)
@ret(index=False, header=False)
def correl2(df):
    return df.corr()
```

For an overview of the available converters and options, have a look at [Converters and Options](https://docs.xlwings.org/en/latest/converters.html).

## Using type hints instead of decorators

You can use type hints instead of or in combination with decorators:

```python
from xlwings.server import func
import pandas as pd

@func
def myfunction(df: pd.DataFrame) -> pd.DataFrame:
    # df is a DataFrame, do something with it
    return df
```

In this example, the return type (`-> pd.DataFrame`) is optional, as xlwings automatically checks the type of the returned object.

If you need to provide additional conversion arguments, you can either provide them via an annotated type hint or via a decorator. Note that when you use type hints and decorators together, decorators override type hints for conversion.

To set `index=False` for both the argument and the return value, you can annotate the type hint like this:

```python
from typing import Annotated
from xlwings.server import func
import pandas as pd

@func
def myfunction(
    df: Annotated[pd.DataFrame, {"index": False}]
) -> Annotated[pd.DataFrame, {"index": False}]:
    # df is a DataFrame, do something with it
    return df
```

As this might be a little harder to read, you can extract the type definition, which also allows you to reuse it like so:

```python
from typing import Annotated
from xlwings.server import func
import pandas as pd

Df = Annotated[pd.DataFrame, {"index": False}]

@func
def myfunction(df: Df) -> Df:
    # df is a DataFrame, do something with it
    return df
```

Alternatively, you could also combine type hints with decorators:

```python
from typing import Annotated
from xlwings.server import func, arg, ret
import pandas as pd

@func
@arg("df", index=False)
@ret(index=False)
def myfunction(df: pd.DataFrame) -> pd.DataFrame:
    # df is a DataFrame, do something with it
    return df
```

## Variable number of arguments (`*args`)

Varargs are supported. You can also use a converter, which will be applied to all arguments provided by `*args`:

```python
from xlwings.server import func, arg

@func
@arg("*args", pd.DataFrame, index=False)
def concat(*args):
    return pd.concat(args)
```

and the same with type hints:

```python
from typing import Annotated
from xlwings.server import func

@func
def concat(*args: Annotated[pd.DataFrame, {"index": False}]):
    return pd.concat(args)
```

## Doc strings

To describe your function and its arguments, you can use a function docstring or the `arg` decorator, respectively:

```python
from xlwings.server import func, arg

@func
@arg("name", doc='A name such as "World"')
def hello(name):
    """This is a classic Hello World example"""
    return f"Hello {name}!"
```

And again with type hints:

```python
from typing import Annotated
from xlwings.server import func

@func
def hello(name: Annotated[str, {"doc": 'A name such as "World"'}]):
    """This is a classic Hello World example"""
    return f"Hello {name}!"
```

These doc strings will appear in Excel's function wizard/formula builder. Note that the name of the arguments will automatically be shown when typing the formula into a cell (intellisense).

## Date and time

Depending on whether you're reading from Excel or writing to Excel, there are different tools available to work with date and time.

### Reading date and time

In the context of custom functions, xlwings will detect numbers, strings, and booleans but not cells with a date/time format. Hence, you need to use converters. For single datetime arguments do this:

```python
import datetime as dt
from xlwings.server import func

@func
@arg("date", dt.datetime)
def isoformat(date):
    return date.isoformat()
```

And again with type hints:

```python
import datetime as dt
from xlwings.server import func

@func
def isoformat(date: dt.datetime):
    return date.isoformat()
```

Instead of `dt.datetime`, you can also use `dt.date` to get a date object instead.

If you have multiple values that you need to convert, you can use the `xlwings.to_datetime()` function:

```python
import datetime as dt
import xlwings as xw
from xlwings.server import func

@func
def isoformat(dates):
    dates = [xw.to_datetime(d) for d in dates]
    return [d.isoformat() for d in dates]
```

And if you are dealing with pandas DataFrames, you can simply use the `parse_dates` option. It behaves the same as with `pandas.read_csv()`:

```python
import pandas as pd
from xlwings.server import func, arg

@func
@arg("df", pd.DataFrame, parse_dates=[0])
def timeseries_start(df):
    return df.index.min()
```

and again with type hints:

```python
from typing import Annotated
import pandas as pd
from xlwings.server import func

@func
def timeseries_start(df: Annotated[pd.DataFrame, {"parse_dates": [0]}]):
    return df.index.min()
```

Like `pandas.read_csv()`, you could also provide `parse_dates` with a list of columns names instead of indices.

### Writing date and time

When writing datetime object to Excel, xlwings automatically formats the cells as date if your version of Excel supports data types, so no special handling is required:

```python
import datetime as dt
import xlwings as xw
from xlwings.server import func

@func
def pytoday():
    return dt.date.today()
```

By default, it will format the date according to the cultural info of your Excel instance, but you can also override this by explicitly providing the `date_format` option or the `XLWINGS_DATE_FORMAT` environment variable:

```python
import datetime as dt
import xlwings as xw
from xlwings.server import func

@func
@ret(date_format="yyyy-m-d")
def pytoday():
    return dt.date.today()
```

and again with type hints:

```python
import datetime as dt
import xlwings as xw
from xlwings.server import func

@func
def pytoday() -> Annotated[dt.date, {"date_format": "yyyy-m-d"}]:
    return dt.date.today()
```

For the accepted `date_format` string, consult the [official Excel documentation](https://support.microsoft.com/en-us/office/format-numbers-as-dates-or-times-418bd3fe-0577-47c8-8caa-b4d30c528309).

```{note}
Some older builds of Excel don't support date formatting and will display the date as date serial instead, requiring you format it manually. See also [](#limitations).
```

## Namespace

A namespace groups related custom functions together by prepending the namespace to the function name, separated with a dot. For example, to have NumPy-related functions show up under the numpy namespace, you could do:

```python
import numpy as np
from xlwings.server import func

@func(namespace="numpy")
def standard_normal(rows, columns):
    rng = np.random.default_rng()
    return rng.standard_normal(size=(rows, columns))
```

This function will be shown as `NUMPY.STANDARD_NORMAL` in Excel.

### Sub-namespace

You can create sub-namespaces by including a dot like so:

```python
@func(namespace="numpy.random")
```

This function will be shown as `NUMPY.RANDOM.STANDARD_NORMAL` in Excel.

### Default namespace

The default namespace is `XLWINGS`, but you can change it via the following [config](server_config.md):

```
XLWINGS_FUNCTIONS_NAMESPACE="XLWINGS"
```

```{note}
- After changing the setting, you will need to update your `manifest.xml` with the values from the `/manifest` endpoint.
- The `XLWINGS_ENVIRONMENT` is automatically appended to the global function namespace if it is not `"prod"` so if `XLWINGS_ENVIRONMENT="dev"`, your functions will appear under the namespace `XLWINGS_DEV`.
```

If you define a namespace as part of the function decorator while also having a default namespace defined, the namespace from the function decorator will define the sub-namespace.

## Help URL

You can include a link to an internet page with more information about your function by using the `help_url` option. The function wizard/formula builder will show that link under "More help on this function".

```python
from xlwings.server import func

@func(help_url="https://www.xlwings.org")
def hello(name):
    return f"Hello {name}!"
```

## Array Dimensions

If you want your function to accept arguments of any dimensions (as single cell or one- or two-dimensional ranges), you may need to use the `ndim` option to make your code work in every case. Likewise, you can return a simple list in a vertical orientation by using the `transpose` option.

### Dimension of arguments

Depending on the dimensionality of the function parameters, xlwings either delivers a scalar, a list, or a nested list:

- Single cells (e.g., `A1`) arrive as scalar, i.e., number, string, or boolean: `1` or `"text"`, or `True`
- A one-dimensional (vertical or horizontal!) range (e.g. `A1:B1` or `A1:A2`) arrives as list: `[1, 2]`
- A two-dimensional range (e.g., `A1:B2`) arrives as nested list: `[[1, 2], [3, 4]]`

This behavior is not only consistent in itself, it's also in line with how NumPy works and is often what you want: for example, you can directly loop over a vertical 1-dimensional range of cells.

However, if the argument can be anything from a single cell to a one- or two-dimensional range, you'll want to use the `ndim` option: this allows you to always get the inputs as a one- or two-dimensional list, no matter what the input dimension is:

```python
from xlwings.server import func, arg

@func
@arg("x", ndim=2)
def add_one(x):
    return [[cell + 1 for cell in row] for row in data]
```

and again with type hints:

```python
from typing import Annotated
from xlwings.server import func

@func
def add_one(x: Annotated[float, {"ndim": 2}]):
    return [[cell + 1 for cell in row] for row in data]
```

The above sample would raise an error if you'd leave away the `ndim=2` and use a single cell as argument `x`.

### Dimension of return value

If you need to write out a list in vertical orientation, the `transpose` option comes in handy:

```python
from xlwings.server import func, ret

@func
@ret(transpose=True)
def vertical_list():
    return [1, 2, 3, 4]
```

and again with type hints:

```python
from typing import Annotated
from xlwings.server import func

@func
def vertical_list() -> Annotated[list, {"transpose": True}]:
    return [1, 2, 3, 4]
```

## Error handling and error cells

Error cells in Excel such as `#VALUE!` are used to display an error from Python. xlwings reads error cells as `None` by default but also allows you to read them as strings. When writing to Excel, you can Excel have a cell formatted as error. Let's get into the details!

### Error handling

Whenever there's an error in Python, the cell value will show `#VALUE!`. To understand what's going on, click on the cell with the error, then hover (don't click!) on the exclamation mark that appears: you'll see the error message.

If you see `Internal Server Error`, you will need to consult the Python server logs.

```{note}
When you run xlwings Server with `XLWINGS_ENVIRONMENT=prod`, it only shows `xlwings.XlwingsError` in Excel, but during development with `XLWIINGS_ENVIRONMENT=dev`, it shows all errors.
```

### Writing NaN values

`np.nan` and `pd.NA` will be converted to Excel's `#NUM!` error type.

### Error cells

#### Reading error cells

By default, error cells are converted to `None` (scalars and lists) or `np.nan` (NumPy arrays and pandas DataFrames). If you'd like to get them in their string representation, use `err_to_str` option:

```python
from xlwings.server import func, arg

@func
@arg("x", err_to_str=True)
def myfunc(x):
    ...
```

and again with type hints:

```python
from typing import Annotated, Any
from xlwings.server import func

@func
def myfunc(x: Annotated[list[list[Any]], {"err_to_str"=True}):
    ...
```

#### Writing error cells

To format cells as proper error cells in Excel, simply use their string representation (`#DIV/0!`, `#N/A`, `#NAME?`, `#NULL!`, `#NUM!`, `#REF!`, `#VALUE!`):

```python
from xlwings.server import func

@func
def myfunc(x):
    return ["#N/A", "#VALUE!"]
```

```{note}
Some older builds of Excel don't support proper error types and will display the error as string instead, see also [](#limitations).
```

## Dynamic arrays

If your return value is a one- or two-dimensional array such as a list, NumPy array, or pandas DataFrame, Excel will automatically spill the values into the surrounding cells by using the native dynamic arrays. There are no code changes required:

Returning a simple list:

```python
from xlwings.server import func

@func
def programming_languages():
    return ["Python", "JavaScript"]
```

Returning a NumPy array with standard normally distributed random numbers:

```python
import numpy as np
from xlwings.server import func

@func
def standard_normal(rows, columns):
    rng = np.random.default_rng()
    return rng.standard_normal(size=(rows, columns))
```

Returning a pandas DataFrame:

```python
import pandas as pd
from xlwings.server import func

@func
def get_dataframe():
    df = pd.DataFrame({"Language": ["Python", "JavaScript"], "Year": [1991, 1995]})
    return df
```

## Volatile functions

Volatile functions are recalculated whenever Excel calculates something, even if none of the function arguments have changed. To mark a function as volatile, use the `volatile` argument in the `func` decorator:

```python
import datetime as dt
from xlwings.server import func

@func(volatile=True)
def last_calculated():
    return f"Last calculated: {dt.datetime.now()}"
```

## Asynchronous functions

Custom functions are always asynchronous, meaning that the cell will show `#BUSY!` during calculation, allowing you to continue using Excel: custom functions don't block Excel's user interface.

## Streaming functions ("RTD functions")

In the traditional version of Excel, streaming functions were called "RTD functions" or "RealTimeData functions". However, unlike traditional RTD functions, streaming functions don't use a local COM server. Instead, the process runs as a background task on xlwings Server and pushes updates via WebSockets (using Socket.io) to Excel. What's great about streaming functions is that you can connect to your data source in a single place and stream the values to every Excel installation in your entire company.

To create a streaming function, you simply need to write an asynchronous generator. That is, you need to use `async def` and `yield` instead of `return`, e.g.:

```python
import asyncio
import numpy as np
import pandas as pd
from xlwings.server import func

@func
async def streaming_random(rows, cols):
    """A streaming function pushing updates of a random DataFrame every second"""
    rng = np.random.default_rng()
    while True:
        matrix = rng.standard_normal(size=(rows, cols))
        df = pd.DataFrame(matrix, columns=[f"col{i+1}" for i in range(matrix.shape[1])])
        yield df
        await asyncio.sleep(1)
```

As a bit of a more real-world sample, here's how you can transform a REST API into a streaming function to stream the BTC price:

```python
import asyncio
import httpx
import pandas as pd
from xlwings.server import func, ret

@func
@ret(date_format="hh:mm:ss", index=False)
async def btc_price(base_currency="USD"):
    while True:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://cex.io/api/ticker/BTC/{base_currency}"
            )
        response_data = response.json()
        response_data["timestamp"] = pd.to_datetime(
            int(response_data["timestamp"]), unit="s"
        )
        df = pd.DataFrame(response_data, index=[0])
        df = df[["pair", "timestamp", "bid", "ask"]]
        yield df
        await asyncio.sleep(1)
```

Key to remember is that you're moving in the async world with streaming functions, so you shouldn't use long-running blocking operations. For example, instead of using `requests` to fetch the data, you should use one of the async libraries such as `httpx` or `aiohttp`.

## Object handles

Object handles allow you to return Python objects such as a pandas DataFrame to a single cell. Other custom functions can then use the cell with the object handle as a function argument for further manipulation. This functionality is especially helpful if you have huge amounts of data or if the object can't be "translated" into Excel cells.

```{figure} ./images/object_handles.png

```

To make a custom function return an object, simply specify the `object` type hint for the return value:

```python
from typing import Annotated
from xlwings.server import func, ret
from xlwings.constants import ObjectHandleIcons

@func
async def get_mymodel() -> object:
    return pd.DataFrame(
        {"A": [1, 2, 3, 4, 5], "B": [10, 8, 6, 4, 2], "C": [10, 9, 8, 7, 6]}
    )
```

By default, this will display an icon in the cell together with the data type of the object (cell `A1` in the screenshot). By clicking on the icon, you will get some info about that object. You can, however, add valuable information by specifying a different text and/or icon (cell `A3` in the screenshot). You can use an annotated type hint for this or provide the additional arguments via the `ret` decorator:

```python
@func
@ret(icon=ObjectHandleIcons.table, text="My Model")
async def get_mymodel() -> object:
    return pd.DataFrame(
        {"A": [1, 2, 3, 4, 5], "B": [10, 8, 6, 4, 2], "C": [10, 9, 8, 7, 6]}
    )
```

To do the same via annotated type hint, you would do:

```python
@func
async def get_mymodel() -> Annotated[object, {"icon": ObjectHandleIcons.table, "text": "My Model"}]:
    return pd.DataFrame(
        {"A": [1, 2, 3, 4, 5], "B": [10, 8, 6, 4, 2], "C": [10, 9, 8, 7, 6]}
    )
```

To be able to use an object handle as argument in another function, just use the `object` type hint with the argument. A simple `view` function to translate an object handle to Excel values would look like this:

```python
@func
async def view(obj: object):
    return obj
```

In the [custom functions examples](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions/examples.py), you will find a slightly more sophisticated `view` function that optionally allows you to return just the first couple of rows.

If you are looking for functionality similar to how the `xl()` function works in Microsoft's Python in Excel, you can do it as follows:

```python
@func
async def to_df(df: pd.DataFrame) -> object:
    return df
```

This turns an existing Excel range into a DataFrame. Using an Excel table as your source range is a good idea as it makes your object handle dynamically update whenever you resize the Excel table.

```{note}
- This feature requires xlwings Server v0.5.0+ as well as a Redis/ValKey database for production via `XLWINGS_OBJECT_CACHE_URL`. The object cache is purged once a week, but this can be configured via `XLWINGS_OBJECT_CACHE_EXPIRE_AT`. Alternatively, you'll find a function called `clear_object_cache` in the examples.
- For development purposes, you don't need Redis, but the cache is in-memory and thus only works with a single worker/process for as long as the app runs. More importantly, there won't be any automatic cache purging happening.
```

You can return the majority of Python data types such as simple lists, dictionaries, and tuples. NumPy arrays and pandas DataFrames/Series are also supported. For unsupported data types, a custom serializer can be written and registered (see [`app/serializers/pandas_serializer.py`](https://github.com/xlwings/xlwings-server/blob/main/app/serializers/pandas_serializer.py) for an example).

The object handles are stored in the cache using a key that derives from the add-in installation, workbook name and cell address, i.e, objects are not shared across different Excel installations or users.

## Custom functions vs. classic UDFs

While Office.js-based custom functions are mostly compatible with the VBA-based UDFs, there are a few differences, which you should be aware of when switching from UDFs to custom functions or vice versa:

:::{list-table}
:header-rows: 1

- -
  - Custom functions (Office.js-based)
  - User-defined functions UDFs (VBA-based)

- - Supported platforms
  - - Windows
    - macOS
    - Excel on the web
  - - Windows

- - Empty cells are converted to
  - `0` => If you want `None`, you have to set the following formula in Excel: `=""`
  - `None`

- - Cells with integers are converted to
  - Integers
  - Floats

- - Reading Date/Time-formatted cells
  - Requires the use of `dt.datetime` or `parse_dates` in the arg decorators
  - Automatic conversion

- - Writing datetime objects
  - Automatic cell formatting
  - No cell formatting

- - Can write proper Excel cell error
  - Yes
  - No

- - Writing `NaN` (`np.nan` or `pd.NA`) arrives in Excel as
  - `#NUM!`
  - Empty cell

- - Functions are bound to
  - Add-in
  - Workbook

- - Asynchronous functions
  - Always and automatically
  - Requires `@xw.func(async_mode="threading")`

- - Decorators
  - `from xlwings.server import func, ret, arg`, then `func` etc.
  - `import xlwings as xw`, then `xw.func` etc.

- - Formula Intellisense
  - Yes
  - No

- - Supports namespaces e.g., `NAMESPACE.FUNCTION`
  - Yes
  - No

- - Capitalization of function name
  - Excel formula gets automatically capitalized
  - Excel formula has same capitalization as Python function

- - Supports (SSO) Authentication
  - Yes
  - No

- - `caller` function argument
  - N/A
  - Returns Range object of calling cell

- - `@xw.arg(vba=...)`
  - N/A
  - Allows to access Excel VBA objects

- - Supports pictures
  - No
  - Yes

- - Requires a local installation of Python
  - No
  - Yes

- - Python code must be shared with end-user
  - No
  - Yes

- - Requires License Key
  - Yes
  - No

- - License
  - PolyForm Noncommercial License 1.0.0 or xlwings PRO License
  - BSD 3-clause Open Source License

:::

## Limitations

- Custom functions are only supported with Office.js add-in.
- The Office.js Custom Functions API was introduced in 2018 and therefore requires at least Excel 2021 or Excel 365.
- Note that some functionality requires specific build versions, such as error cells and date formatting, but if your version of Excel doesn't support these features, xlwings will fall back to either string-formatted error messages or unformatted date serials. For more details on which builds support which function, see [Custom Functions requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/excel/custom-functions-requirement-sets).
