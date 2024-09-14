# Custom Scripts

Custom scripts can be connected to buttons on either the Ribbon or the task pane. They are the equivalent to a `Sub` in VBA.

## Basic syntax

As you can see in the [examples](https://github.com/xlwings/xlwings-server/blob/main/app/custom_scripts/examples.py), the simplest custom script requires:

- the `@script` decorator
- a function argument with the `xw.Book` type hint

Here is how this looks:

```python
import xlwings as xw
from xlwings.server import script

@script
def hello_world(book: xw.Book):
    sheet = book.sheets[0]
    sheet["A1"].value == "Hello xlwings!"
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

## Office.js add-in

With Office.js add-ins, you can either bind a button on the ribbon or on the task pane to a custom script. Since placing a button on the task pane is easier, we'll start with that!

### Bind a script to a button on the task pane

On the task pane, connecting a button is as easy as adding the `xw-click` attribute with the name of the Python function. You can optionally configure it via `xw-config`:

```html
<button
  xw-click="hello_world"
  xw-config='{"include": "Sheet1"}'
  class="btn btn-primary btn-sm"
  type="button"
>
  Hello World
</button>
```

The default task pane from the examples includes the full code: [`app/templates/examples/hello_world/taskpane_hello.html`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/examples/hello_world/taskpane_hello.html).

### Bind a script to a button on the Ribbon

To connect a button on the ribbon to your script, you need a bit more work:

[`app/templates/manifest.xml`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/manifest.xml) has a section where it defines a ribbon button:

```xml
<!-- Ribbon button that calls a function -->
<Control xsi:type="Button" id="MyFunctionButton">
    <!-- Label for your button. resid must point to a ShortString resource -->
    <Label resid="MyFunctionButton.Label" />
    <Supertip>
    <!-- ToolTip title. resid must point to a ShortString resource -->
    <Title resid="MyFunctionButton.Label" />
    <!-- ToolTip description. resid must point to a LongString resource -->
    <Description resid="MyFunctionButton.Tooltip" />
    </Supertip>
    <Icon>
    <bt:Image size="16" resid="Icon.16x16" />
    <bt:Image size="32" resid="Icon.32x32" />
    <bt:Image size="80" resid="Icon.80x80" />
    </Icon>
    <!--Action type must be ExecuteFunction -->
    <Action xsi:type="ExecuteFunction">
    <!-- This is the name that you use in Office.actions.associate() to connect it to a function -->
    <FunctionName>hello-ribbon</FunctionName>
    </Action>
</Control>
```

To make this work, you need to provide a bit of JavaScript code that you can find in [app/static/js/ribbon.js](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/ribbon.js):

```js
async function helloRibbon(event) {
  let token = await globalThis.getAuth();
  xlwings.runPython(
    // replace hello_world with the name of your script
    window.location.origin + "/xlwings/custom-scripts-call/hello_world",
    { auth: token },
  );
  event.completed();
}
// hello-ribbon must correspond to what is used as FunctionName in the manifest
Office.actions.associate("hello-ribbon", helloRibbon);
```

## Office Scripts and Google Apps Script clients

If you want to call a custom script from Office Scripts or Google Apps Script, you will need to use the `runPython` function with the following endpoint:

```js
runPython("https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world");
```

Make sure to replace `hello_world` with the name of your custom script and `YOUR_SERVER` with your own URL, such as `127.0.0.1:8000`!

## VBA

If you want to call a custom script from VBA, you will need to use the `RunRemotePython` function with the following endpoint:

```vb.net
RunRemotePython("https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world")
```

Make sure to replace `hello_world` with the name of your custom script and `YOUR_SERVER` with your own URL, such as `127.0.0.1:8000`!

## Limitations

- Currently, custom scripts don't accept arguments other than the special type-hinted ones (`xw.Book` and `app.models.user.CurrentUser`).
