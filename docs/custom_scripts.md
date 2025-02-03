# Custom Scripts

Custom scripts can be connected to buttons on either the Ribbon or the task pane. They are the equivalent to a `Sub` in VBA or an Office Script.

## Basic syntax

As you can see in the [examples](https://github.com/xlwings/xlwings-server/blob/main/app/custom_scripts/examples.py), the simplest custom script requires:

- the `@script` decorator
- a function argument with the `xw.Book` type hint

Otherwise, they work like [classic xlwings Scripts](https://docs.xlwings.org).

Here is how this looks:

```python
import xlwings as xw
from xlwings.server import script

@script
def hello_world(book: xw.Book):
    sheet = book.sheets[0]
    sheet["A1"].value = "Hello xlwings!"
```

```{note}
- The `script` decorator is imported from `xlwings.server` rather than `xlwings`.
- While it's ok to edit the functions in `examples.py` to try things out, you shouldn't commit the changes to Git to prevent future merge conflicts. Rather, create a new Python module as explained in the next section.
```

## Adding new custom scripts

Here is how you can write your own custom scripts:

1. Add a Python module under [`app/custom_scripts`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_scripts), e.g., `myscripts.py`.
2. Add the following import statement (highlighted line) to [`app/custom_scripts/__init__.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_scripts/__init__.py):

```{code-block} python
:emphasize-lines: 6

from ..config import settings

if settings.enable_examples:
    from .examples import *

from .myscripts import *
```

## Running a Script

How you run a script depends on the integration you're using:

- [Office.js add-ins](officejs_run_scripts.md)
- [](vba_integration.md)
- [](officescripts_integration.md)
- [](googleappsscript_integration.md)

## Limitations

Currently, custom scripts don't accept arguments other than the special type-hinted ones (`xw.Book` and `app.models.user.CurrentUser`).
