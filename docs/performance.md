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
@arg("x", np.array, ndim=2)
@arg("y", np.array)
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
- Use `asyncpg` or `psycopg3` instead of `pscycopg2`

## Caching

Caching means that a slow function is calculated only once. Its result is then stored in a cache, which will be used to serve the next request, avoiding the need to perform the same slow calculation again. You can use caching on the server and client side.

- Client (Office.js): Set `cache=True` on a custom function to return repeated results from the Excel add-in without a server request:

  ```python
  from xlwings.server import func

  @func(cache=True)
  def history(ticker, refresh_token):
      return fetch_history(ticker)
  ```

  The cache uses all argument values, so changing the ticker or a button-controlled refresh token calls the server again. It is a bounded, memory-only cache for the current add-in runtime; closing or reloading that runtime clears it. Matching calls in the same workbook share a result, except functions that use `Caller`, whose results are scoped to the calling cell. Authentication contexts are kept separate. Rich data, object handles, errors, and functions that request a follow-up script are not cached. Use this only for functions without side effects or authorization-sensitive results: cache hits skip the server, including its authorization checks. Streaming and volatile functions cannot set `cache=True`.

- Server: You can decorate a synchronous function with `functools.cache`. Note that this cache will be separate per [app worker](production.md#workers), and `functools.cache` does not cache results of `async def` functions:

  ```python
  from functools import cache

  @cache
  def slow_funcion():
      ...
  ```

## Streaming functions

[Streaming functions](custom_functions.md#streaming-functions-rtd-functions) use Socket.io behind the scenes. To avoid blocking Python's event loop, the Socket.io server shouldn't manage any long-running tasks, such as slow, CPU-bound functions. Often, this isn't an issue as streaming functions are primarily used to stream data from external services (e.g., market data). As long as you can query these external services via an async HTTP request or similar (e.g., using `httpx` or `aiohttp`), you're good!
