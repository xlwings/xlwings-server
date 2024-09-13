# Google Apps Script Client

1. Run `xlwings copy gs` in a Terminal/Command Prompt.
2. In Google Sheets, click on `Extensions` > `Apps Script`. This will open a separate browser tab and open a file called `Code.gs` with a function stub. Replace this function stub with the copied code from the previous step and click on the `Save` icon.
3. Scroll to the very top and replace `url` with `https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world` so that the full functions reads:

   ```js
   function hello() {
     runPython("https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world");
   }
   ```

4. Click on `Save Project`.
5. Click on `Run`.

Then hit the `Run` button (the `hello` function should be automatically selected in the dropdown to the right of it). If you run this the very first time, Google Sheets will ask you for the permissions it needs. Once approved, the script will run the `hello_world` function and write `Hello xlwings!` into cell `A1`.

To add a button to a sheet to run this function, switch from the Apps Script editor back to Google Sheets, click on `Insert` > `Drawing` and draw a rounded rectangle. After hitting `Save and Close`, the rectangle will appear on the sheet. Select it so that you can click on the 3 dots on the top right of the shape. Select `Assign Script` and write `hello` in the text box, then hit `OK`.
