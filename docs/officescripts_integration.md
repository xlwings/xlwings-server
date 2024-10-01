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

## Adding a button

Office Scripts also allows you to put a button on a sheet to trigger the script. Click the 3 dots at the top right of the Office Script and select `+ Add in workbook`.
