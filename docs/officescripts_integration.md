# Office Scripts

1. Run `xlwings copy os` in a Terminal/Command Prompt.
2. In the Excel ribbon, under the `Automate` tab, click on `New Script`.
3. Select everything in the Office script and hit `Ctrl+V` (Windows) or `Cmd+V` (macOS), respectively, to paste the code that we copied in step 1.
4. Scroll to the very top and replace `url` with `https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world` so that the full functions reads:

   ```ts
   async function main(workbook: ExcelScript.Workbook) {
     await runPython(
       workbook,
       "https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world",
     );
   }
   ```

   Make sure to replace `YOUR_SERVER` with the URL of your server and `hello_world` with the name of your custom script.

5. Click on `Save Script`.
6. Click on `Run`.

For configuration, see [](#config) below.

## Adding a button

Office Scripts also allows you to put a button on a sheet to trigger the script. Click the 3 dots at the top right of the Office Script and select `+ Add in workbook`.

## Config

Here are the settings that you can provide in the config dictionary:

- `exclude` (optional): By default, xlwings sends over the complete content of the whole workbook to the server. If you have sheets with big amounts of data, this can make the calls slow or timeout. If your backend doesn’t need the content of certain sheets, the exclude option will block the sheet’s content (e.g., values, pictures, etc.) from being sent to the backend. Currently, you can only exclude entire sheets as comma-delimited string like so: `"Sheet1, Sheet2"`.

- `include` (optional): It’s the counterpart to exclude and allows you to submit the names of the sheets whose content (e.g., values, pictures, etc.) you want to send to the server. Like exclude, include accepts a comma-delimited string, e.g., `"Sheet1, Sheet2"`.

- `headers` (optional): A dictionary with name/value pairs that will be provided as HTTP request headers.

- `auth` (optional): This will set the Authorization HTTP request header, see [](authentication.md).

Here is a complete example of how to provide a config along with your `runPython` call:

```ts
async function main(workbook: ExcelScript.Workbook) {
  await runPython(
    workbook,
    "https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world",
    {
      auth: "xxxxxxxxxxxx",
      exclude: "Sheet1,Sheet2",
      headers: { key1: "value1" },
    },
  );
}
```
