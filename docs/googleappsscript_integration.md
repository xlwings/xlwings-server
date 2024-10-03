# Google Apps Script

1. Run `xlwings copy gs` in a Terminal/Command Prompt.
2. In Google Sheets, click on `Extensions` > `Apps Script`. This will open a separate browser tab and open a file called `Code.gs` with a function stub. Select everything and hit `Ctrl+V` (Windows) or `Cmd+V` (macOS), respectively, to paste the code that we copied in step 1. Then click the `Save` icon.
3. Scroll to the very top and replace `url` with `https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world` so that the full functions reads:

   ```js
   function helloWorld() {
     runPython("https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world");
   }
   ```

   Make sure to replace `YOUR_SERVER` with the URL of your server and `hello_world` with the name of your custom script.

4. Click on `Save Project`.
5. Hit the `Run` button (the `hello` function should be automatically selected in the dropdown to the right of it). If you run this the very first time, Google Sheets will ask you for the permissions it needs. Once approved, the script will run the `hello_world` function and write `Hello xlwings!` into cell `A1`.

## Adding a button

To add a button to a sheet to run this function, switch from the Apps Script editor back to Google Sheets, click on `Insert` > `Drawing` and draw a rounded rectangle. After hitting `Save and Close`, the rectangle will appear on the sheet. Select it so that you can click on the 3 dots on the top right of the shape. Select `Assign Script` and write `hello` in the text box, then hit `OK`.

## Adding a custom menu

Alternatively, you could also create an menu item that runs this code. This is as easy as adding the following code:

```js
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("My Menu").addItem("Run hello world", "helloWorld").addToUi();
}
```

## Triggers

You can take advantage of the integrated Triggers (accessible from the menu on the left-hand side of the Apps Script editor). You can trigger your xlwings functions on a schedule or via event, such as opening or editing a sheet.

## Config

Here are the settings that you can provide in the config dictionary:

- `exclude` (optional): By default, xlwings sends over the complete content of the whole workbook to the server. If you have sheets with big amounts of data, this can make the calls slow or timeout. If your backend doesn’t need the content of certain sheets, the exclude option will block the sheet’s content (e.g., values, pictures, etc.) from being sent to the backend. Currently, you can only exclude entire sheets as comma-delimited string like so: `"Sheet1, Sheet2"`.

- `include` (optional): It’s the counterpart to exclude and allows you to submit the names of the sheets whose content (e.g., values, pictures, etc.) you want to send to the server. Like exclude, include accepts a comma-delimited string, e.g., `"Sheet1, Sheet2"`.

- `headers` (optional): A dictionary with name/value pairs that will be provided as HTTP request headers.

- `auth` (optional): This will set the Authorization HTTP request header, see [](authentication.md).

Here is a complete example of how to provide a config along with your `runPython` call:

```js
function helloWorld() {
  runPython("https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world", {
    auth: "xxx",
    exclude: "Sheet1, Sheet2",
    headers: { key1: "value1" },
  });
}
```
