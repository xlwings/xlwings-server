# Missing Features

In the local version of xlwings, you can use the `.api` property to fall back to the underlying automation library and work around missing features in xlwings. That's not possible with xlwings Server.

Instead, call the `book.app.macro()` method to run client-side functions in JavaScript. The following examples assume that `myrange.wrap_text()` isn't natively available and therefore uses a macro to provide the missing functionality.

The first parameter will have to be the request context, which gives you access to the Excel JavaScript API. Note that you have to register JavaScript functions that you want to call from Python via `xlwings.registerCallback()` (last line):

The following code snippet has to be copied to `static/js/main.js`:

```js
async function wrapText(context, sheetName, cellAddress) {
  // The first parameter has to be the request context, the others
  // are those parameters that you will provide via Python
  const range = context.workbook.worksheets
    .getItem(sheetName)
    .getRange(cellAddress);
  range.format.wrapText = true;
  await context.sync();
}
// Make sure to register the function as callback
xlwings.registerCallback(wrapText);
```

Now you can call this function from Python like so:

```python
# book is an xlwings Book object
wrap_text = book.app.macro("wrapText")
wrap_text("Sheet1", "A1")
wrap_text("Sheet2", "B2")
```
