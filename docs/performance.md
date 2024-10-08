# Performance

Here are a few recipes that you can consider to improve performance.

## Custom Scripts

By default, custom scripts send the content of the entire workbook to the backend. Most of the time, this is not required, so you can include or exclude specific sheets via the `include` and `exclude` config, see your specific integration for more details: [Office.js Add-ins](officejs_run_scripts.md), [](vba_integration.md), [](googleappsscript_integration.md), or [](officescripts_integration.md).

## Custom Functions

While xlwings can handle 10,000s of custom functions, there is an easy way to to make custom functions perform better: reduce their number. And this can often be achieved by using dynamic arrays in place of many single-cell functions. Consider the following example:

```python
import numpy as np
from xlwings.server import func, arg


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

- Client ("integration"): While the client side would be more attractive, as this would save you not only from running the function but also from waiting for the network call, it isn't available yet. It is tracked as [GitHub issue](https://github.com/xlwings/xlwings-server/issues/86).
- Server: You can decorate your function with `functools.cache`. Note that this cache will be separate per [app worker](production.md#workers):

  ```python
  from functools import cache

  @cache
  def slow_funcion():
      ...
  ```

## Streaming functions

[Streaming functions](custom_functions.md#streaming-functions-rtd-functions) use Socket.io behind the scenes. To avoid blocking Python's event loop, the Socket.io server shouldn't manage any long-running tasks, such as slow, CPU-bound functions. Often, this isn't an issue as streaming functions are primarily used to stream data from external services (e.g., market data). As long as you can query these external services via an async HTTP request or similar (e.g., using `httpx` or `aiohttp`), you're good!
