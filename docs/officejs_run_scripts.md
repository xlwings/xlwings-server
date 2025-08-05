# Run Custom Scripts

With Office.js add-ins, you can bind a custom script to buttons in various places:

- [](#task-pane-button)
- [](#sheet-button)
- [](#ribbon-button)

## Task pane button

On the task pane, connecting a button is as easy as adding the `xw-click` attribute with the name of the Python function:

```html
<button
  xw-click="hello_world"
  class="btn btn-primary btn-sm"
  type="button"
>
  Hello World
</button>
```

The default task pane from the examples includes the full code: [`app/templates/examples/hello_world/taskpane_hello.html`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/examples/hello_world/taskpane_hello.html).

See also [](#configuration).

## Sheet button

Office.js doesn't offer a native way to connect a button on a sheet to a custom script. Therefore, xlwings Server offers a solution via shapes and hyperlinks. While this is a workaround, it offers a user experience that is on par with the official buttons that Office Scripts offers.

```{warning}
If your script depends on the selected cells, this solution currently doesn't work as clicking the button will change the selected cell.
```

1. On the Excel ribbon, go to `Insert` > `Shapes` and select e.g., a rounded rectangle. Then draw the shape on the sheet. Adjust colors and text to your liking.
2. Select the shape. In the name box on the top left of the spreadsheet, give it a specific name, e.g., `xlwings_button`.
3. Right-click on the shape and select `Link` (Windows) or `Hyperlink...` (macOS). On the tab `Place in This Document` (Windows) or `This Document` (macOS), where it says `Type the cell reference`, write the name of a cell that the shape covers, e.g., `B4`. Confirm by clicking on `OK`.
4. Provide the following arguments in the `script` decorator (`show_taskpane` is optional and opens the task pane if it closed):

   ```python
   @script(button="[xlwings_button]Sheet1!B4", show_taskpane=True)
   def hello_world(book: xw.Book):
       ...
   ```

5. Set the worksheet up so that it automatically loads the add-in when opened. This is required so that the buttons work automatically after opening a workbook, without the user having to load the task pane of the add-in first. You can do this by running the following command on the console of the Browser's development tools while the desired file is open:

   ```js
   await Office.addin.setStartupBehavior(Office.StartupBehavior.load);
   ```

   After running the command, make sure to save your workbook.

   Should you ever want to disable this behavior again, use (again, make sure to save the workbook after running the command):

   ```js
   await Office.addin.setStartupBehavior(Office.StartupBehavior.none);
   ```

6. Make sure that the cell that `button` references isn't selected, then **reload the add-in**. Now you can click the button.

How does it work? When the add-in loads, it registers an event handler that runs the custom script when the cell that `button` references is selected. This happens when you click the button as we have set up a hyperlink. Immediately after the that cell has been selected, it selects the cell below it to be ready for the next call.

### Sheet Button Troubleshooting:

- Make sure that you haven't initially selected the cell that is referenced under `button`.
- Make sure the button's name and the reference in the script decorator are the same: `button=[button_name]Sheet1!A1`.
- Reload the add-in so that the event handlers are properly registered.

```{note}
Excel on the web doesn't allow you to add a hyperlink to a shape. However, workbooks that were set up on the desktop version of Excel also work with Excel on the web.
```

See also [](#configuration).

## Ribbon button

Connecting a button on the ribbon to your script [is awaiting a more developer-friendly implementation](https://github.com/xlwings/xlwings-server/issues/102), so currently, there's a bit of work to be done:

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
  let scriptName = "hello_world";
  let authResult =
    typeof globalThis.getAuth === "function"
      ? await globalThis.getAuth()
      : { token: "", provider: "" };
  await xlwings.runPython({
    auth: authResult.token,
    scriptName: scriptName,
    headers: { "Auth-Provider": authResult.provider },
  });
  event.completed();
}
Office.actions.associate("hello-ribbon", helloRibbon);
```

If you'd like to disable the ribbon button during the request, this is how you go about it:

```js
async function helloRibbon(event) {
  const createTabsConfig = (enabled) => ({
    // Make sure to update the ids in createTabConfig to match the ones used in manifest.xml
    tabs: [
      {
        id: "MyTab",
        groups: [
          {
            id: "MyCommandsGroup",
            controls: [
              {
                id: "MyFunctionButton",
                enabled: enabled,
              },
            ],
          },
        ],
      },
    ],
  });

  await Office.onReady();
  // Disable the button
  await Office.ribbon.requestUpdate(createTabsConfig(false));

  try {
    let scriptName = "hello_world";
    let authResult =
      typeof globalThis.getAuth === "function"
        ? await globalThis.getAuth()
        : { token: "", provider: "" };
    await xlwings.runPython({
      auth: authResult.token,
      scriptName: scriptName,
      headers: { "Auth-Provider": authResult.provider },
    });
  } finally {
    // Enable the button
    await Office.ribbon.requestUpdate(createTabsConfig(true));
    event.completed();
  }
}
Office.actions.associate("hello-ribbon", helloRibbon);
```

See also [](#configuration).

## Configuration

To configure scripts, you can provide the decorator with arguments, e.g.:

```python
import xlwings as xw
from xlwings.server import script

@script(include=["Sheet1", "Sheet2"])
def hello_world(book: xw.Book):
    sheet = book.sheets[0]
    sheet["A1"].value = "Hello xlwings!"
```

Here are the settings that you can provide:

- `exclude` (optional): By default, xlwings sends over the content of the whole workbook to the server. If you have sheets with big amounts of data, this can make the calls slow or timeout. If your backend doesn’t need the content of certain sheets, the exclude option will block the sheet’s content (e.g., values, pictures, etc.) from being sent to the backend. Currently, you can only exclude entire sheets like so: `exclude=["Sheet1", "Sheet2"]`.

- `include` (optional): It’s the counterpart to exclude and allows you to submit the names of the sheets whose content (e.g., values, pictures, etc.) you want to send to the server. Currently, you can only include entire sheets like so: `include=["Sheet1", "Sheet2"]`.

- `required_roles` (optional): This allows you to require certain roles for a user to be able to execute the script, see [](authorization.md).

- `button` (optional): If you want to use a sheet button, you need to provide the reference for the button and its linked cell, e.g., `button=[mybutton]Sheet1!A1`.

- `show_taskpane` (optional): Use this in connection with `button`. If `show_taskpane=True`, the task pane will automatically show up when the user clicks on a sheet button.
