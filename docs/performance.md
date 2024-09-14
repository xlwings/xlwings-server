# Performance

## Custom Scripts

By default, custom scripts send the content of the entire workbook to the backend. Most of the time, this is not required, so you can include or exclude specific sheets via the `include` and `exclude` parameters, see [](excel_integration_config.md).

## Custom Functions

An easy way to make custom functions perform better is to reduce their number. And this can often be achieved by using dynamic arrays in place of many single-cell functions. Consider the following example:

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
