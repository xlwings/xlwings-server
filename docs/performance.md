# Performance

Here are a few recipes that you can consider to improve performance.

## Custom Scripts

By default, custom scripts send the content of the entire workbook to the backend. Most of the time, this is not required, so you can include or exclude specific sheets via the `include` and `exclude` config, see [](custom_scripts.md#configuration).

## Custom Functions

While xlwings can handle 10,000s of custom functions, there is an easy way to to make custom functions perform better: reduce their number. And this can often be achieved by using dynamic arrays in place of many single-cell functions. Consider the following example:

```python
import numpy as np
from xlwings import func, arg


@func
def mysum(x, y, z):
    return x + y + z


@func
@arg("x", np.ndarray, ndim=2)
@arg("y", np.ndarray)
def myarraysum(x, y, z):
    return x + y + z
```

The first example results in 100 individual function calls on the screenshot:

```{figure} ./images/performance_individual_function.png

```

The second example results in just a single function call:

```{figure} ./images/performance_array_function.png

```

## Async libraries

xlwings Server uses FastAPI, an async web framework. To improve performance, you should use async libraries wherever possible, specifically around IO operations such as querying Web APIs or databases. For example:

- Use `httpx` or `aiohttp` instead of `requests`
- Use `asyncpg` or `psycopg` instead of `pscycopg2`

## Caching

If a custom function repeatedly performs an expensive calculation for the same arguments, [caching](custom_functions.md#caching) can reuse the earlier result and avoid recalculating it.

## Streaming functions

[Streaming functions](custom_functions.md#streaming-functions-rtd-functions) use Socket.io behind the scenes. To avoid blocking Python's event loop, the Socket.io server shouldn't manage any long-running tasks, such as slow, CPU-bound functions. Often, this isn't an issue as streaming functions are primarily used to stream data from external services (e.g., market data). As long as you can query these external services via an async HTTP request or similar (e.g., using `httpx` or `aiohttp`), you're good!
