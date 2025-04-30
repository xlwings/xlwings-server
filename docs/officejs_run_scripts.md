# Run Custom Scripts

With Office.js add-ins, you can bind a custom script to buttons in various places:

- [](#task-pane-button)
- [](#sheet-button)
- [](#ribbon-button)

## Task pane button

On the task pane, connecting a button is as easy as adding the `xw-click` attribute with the name of the Python function. You can optionally configure it via `xw-config`:

```html
<button
  xw-click="hello_world"
  xw-config='{"exclude": "MySheet"}'
  class="btn btn-primary btn-sm"
  type="button"
>
  Hello World
</button>
```

The default task pane from the examples includes the full code: [`app/templates/examples/hello_world/taskpane_hello.html`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/examples/hello_world/taskpane_hello.html).

See also [](#config).

## Sheet button

```{versionadded} 0.6.0

```

Office.js doesn't offer a native way to connect a button on a sheet to a custom script. Therefore, xlwings Server offers a solution via shapes and hyperlinks. While this is a workaround, it offers a user experience that is on par with the official buttons that Office Scripts offers.

1. On the Excel ribbon, go to `Insert` > `Shapes` and select e.g., a rounded rectangle. Then draw the shape on the sheet. Adjust colors and text to your liking.
2. Select the shape. In the name box on the top left of the spreadsheet, give it a specific name, e.g., `xlwings_button`.
3. Right-click on the shape and select `Hyperlink...`. On the tab `This Document`, where it says `Type in the cell reference`, write the name of a cell that lies below the shape, e.g., `B4`. Confirm by clicking on `OK`.
4. Provide the following arguments in the `script` decorator (`config` is optional):

   ```python
   @script(target_cell="[xlwings_button]Sheet1!B4", config={"exclude": "MySheet"})
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

6. Make sure that the `target_cell` isn't selected, then **reload the add-in**. Now you can click the button.

How does it work? When the add-in loads, it registers an event handler that runs the custom script when the `target_cell` is selected. This happens when you click the button as we have set up a hyperlink. Immediately after the `target_cell` has been selected, it selects the cell below it to be ready for the next call.

For troubleshooting, make sure that you haven't initially selected the cell which is the `target_cell`. Then reload the add-in so that the event handlers are properly registered.

```{note}
Excel on the web doesn't allow you to add a hyperlink to a shape. However, workbooks that were set up on the desktop version of Excel also work with Excel on the web.
```

See also [](#config).

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
  let token = await globalThis.getAuth();
  xlwings.runPython(
    // replace hello_world with the name of your script
    window.location.origin + "/xlwings/custom-scripts-call/hello_world",
    { auth: token, exclude: "MySheet" }, // Config
  );
  event.completed();
}
// hello-ribbon must correspond to what is used as FunctionName in the manifest
Office.actions.associate("hello-ribbon", helloRibbon);
```

Note that with Ribbon buttons, you currently need to explicitly provide the `auth` config unlike with task pane and sheet buttons, which handle this behind the scenes. The `auth` config provides the token via Authorization header to the backend.

See also [](#config).

## Config

Here are the settings that you can provide in the config dictionary:

- `exclude` (optional): By default, xlwings sends over the complete content of the whole workbook to the server. If you have sheets with big amounts of data, this can make the calls slow or timeout. If your backend doesn’t need the content of certain sheets, the exclude option will block the sheet’s content (e.g., values, pictures, etc.) from being sent to the backend. Currently, you can only exclude entire sheets as comma-delimited string like so: `"Sheet1, Sheet2"`.

- `include` (optional): It’s the counterpart to exclude and allows you to submit the names of the sheets whose content (e.g., values, pictures, etc.) you want to send to the server. Like exclude, include accepts a comma-delimited string, e.g., `"Sheet1, Sheet2"`.

- `headers` (optional): A dictionary with name/value pairs that will be provided as HTTP request headers. For example:

  ```python
  {"headers": {"key1": "value1", "key2": "value2"}}
  ```
