# Office Scripts Client

1. Run `xlwings copy os` in a Terminal/Command Prompt.
2. In the `Automate` tab of Excel, click on `New Script`.
3. Select everything in the Office script and hit `Ctrl+V` (Windows) or `Cmd+V` (macOS), respectively.
4. Scroll to the very top and replace `url` with `https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world` so that the full functions reads:

   ```ts
   async function main(workbook: ExcelScript.Workbook) {
     await runPython(
       workbook,
       "https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world",
     );
   }
   ```

5. Click on `Save Script`.
6. Click on `Run`.
