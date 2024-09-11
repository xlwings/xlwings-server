# Missing Features

In the local version of xlwings, you can use the `.api` property to fall back to the underlying automation library and work around missing features in xlwings. That's not possible with xlwings Server.

Instead, call the `book.app.macro()` method to run client-side functions in JavaScript or VBA, respectively. The following examples assume that `myrange.wrap_text()` isn't natively available and therefore uses a macro to provide the missing functionality.

## Office.js

The first parameter will have to be the request context, which gives you access to the Excel JavaScript API. Note that you have to register JavaScript functions that you want to call from Python via `xlwings.registerCallback()` (last line):

The following code snippet has to be copied to [app/static/js/main.js](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/main.js):

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

## VBA

Copy the following code snippet into a VBA module:

```vb.net
' The first parameter has to be the workbook, the others
' are those parameters that you will provide via Python
' NOTE: you're limited to 10 parameters
Sub WrapText(wb As Workbook, sheetName As String, cellAddress As String)
    wb.Worksheets(sheetName).Range(cellAddress).WrapText = True
End Sub
```

Now you can call this function from Python like so:

```python
# book is an xlwings Book object
wrap_text = book.app.macro("'MyWorkbook.xlsm'!WrapText")
wrap_text("Sheet1", "A1")
wrap_text("Sheet2", "B2")
```

## Office Scripts

Change your Office Script at the top of the file as follows:

```ts
// Note that you need to register your function before calling runPython
async function main(workbook: ExcelScript.Workbook) {
  registerCallback(wrapText);
  await runPython(workbook, "url", { auth: "DEVELOPMENT" });
}

// The first parameter has to be the workbook, the others
// are those parameters that you will provide via Python
function wrapText(
  workbook: ExcelScript.Workbook,
  sheetName: string,
  cellAddress: string,
) {
  const range = workbook.getWorksheet(sheetName).getRange(cellAddress);
  range.getFormat().setWrapText(true);
}
```

Now you can call this function from Python like so:

```python
# book is an xlwings Book object
wrap_text = book.app.macro("wrapText")
wrap_text("Sheet1", "A1")
wrap_text("Sheet2", "B2")
```

## Google Sheets

Paste the following code in a Google Apps Script module:

```js
// The first parameter has to be the workbook, the others
// are those parameters that you will provide via Python
function wrapText(workbook, sheetName, cellAddress) {
  workbook.getSheetByName(sheetName).getRange(cellAddress).setWrap(true);
}
```

Now you can call this function from Python like so:

```python
# book is an xlwings Book object
wrap_text = book.app.macro("wrapText")
wrap_text("Sheet1", "A1")
wrap_text("Sheet2", "B2")
```
