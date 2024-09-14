# Examples

A great way to get started with xlwings Server is to try out the examples, with their source code available here:

- Custom scripts: [`app/custom_scripts/examples.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_scripts/examples.py).
- Custom functions (only Office.js add-ins): [`app/custom_functions/examples.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions/examples.py)
- Task pane examples (only Office.js add-ins): [`app/templates/examples`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples)

Below are instructions on how to play around with them depending on which client you're using.

## Office.js add-ins

- Custom scripts: you can click the `Hello World` buttons on the ribbon and on the task pane. For an explanation of how everything works, have a look at [](custom_scripts.md).
- Custom functions: in a cell, type: `=XLWINGS.HELLO("world")` ("prod" environment) or `=XLWINGS_DEV.HELLO("world")` ("dev" environment). You should see: `Hello world!`. There are quite a few other (more interesting) examples available that you see when typing `=XLWINGS.` or `=XLWINGS_DEV.` respectively. You can also look at [`app/custom_functions/examples.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions/examples.py).
- Task pane: every directory in [`app/templates/examples`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples) corresponds to an example and has an own `README` with instructions.

## VBA, Office Scripts, and Google Apps Script

These clients only support custom scripts. Please have a look at the respective tutorial on how to run the `hello_world` example:

- [](vba_client.md)
- [](officescripts_client.md)
- [](googleappsscript_client.mdmd)

## How to disable the examples

Once you have your own code, you can switch off all the examples via the following setting:

```ini
XLWINGS_ENABLE_EXAMPLES=false
```
