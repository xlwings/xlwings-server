# VBA

You can either install the classic, VBA-based xlwings add-in, create a custom VBA-based add-in, or create a standalone macro-enabled workbook, which doesn't depend on any add-in. The standalone version is the easiest solution for the end-user, so let's start with this.

## Standalone workbooks

This is a nice solution as you only need to give a macro-enabled workbook (`.xlsm` or `.xlsb`) to your users and everything just works.

1. Run the following command to create a workbook with the required VBA modules (make sure to replace `myproject` with your desired name):

   ```text
   xlwings quickstart myproject --standalone --server
   ```

2. Open the VBA editor via `Alt+F11` and paste the following code into a VBA module (e.g., into `Module1`):

   ```vb.net
   Sub HelloWorld()
       RunRemotePython "https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world"
   End Sub
   ```

   Make sure to replace `YOUR_SERVER` with the URL of your server and `hello_world` with the name of your custom script.

3. Run the `HelloWorld` macro in any way you want, e.g, by clicking into it and hitting `F5` or by adding a button to the sheet that you bind to this macro.

```{note}
- The standalone command requires at least xlwings 0.33.0.
- Currently, you have to run the standalone quickstart command on Windows. However, the created workbook works across Windows and macOS.
```

For configuration, see [](#config) below.

## xlwings add-in

This is a good solution if your users already have the classic, VBA-based xlwings add-in installed or if you want to use the same Python functionality with multiple workbooks, or if you just want to work with normal workbooks (`.xlsx`) instead of macro-enabled workbooks.

1. Install the xlwings add-in locally by running `xlwings addin install` on a Terminal/Command Prompt. If you don't have Python with xlwings installed, you can also install the add-in manually.
2. Create a quick start project by running `xlwings quickstart myproject --server` (make sure to replace `myproject` with your desired name).
3. Follow steps 2. und 3. above under [](#standalone-workbooks).

## Custom add-in

Custom add-ins are a good option if you want to create your own white-labeled VBA add-in. You can use the same Python functionality with multiple workbooks and you can work with normal workbooks (`.xlsx`) instead of macro-enabled workbooks.

1. Create a custom add-in by running the following command:

   ```text
   xlwings quickstart myproject --addin --ribbon --server
   ```

2. Follow steps 2. und 3. above under [](#standalone-workbooks), but to understand

For more details on how to create a custom add-in, have a look at the [custom add-in docs](https://docs.xlwings.org/en/latest/customaddin.html).

## Config

Here are the settings that you can provide with the `RunRemotePython` call:

- `exclude` (optional): By default, xlwings sends over the complete content of the whole workbook to the server. If you have sheets with big amounts of data, this can make the calls slow or timeout. If your backend doesn’t need the content of certain sheets, the exclude option will block the sheet’s content (e.g., values, pictures, etc.) from being sent to the backend. Currently, you can only exclude entire sheets as comma-delimited string like so: `"Sheet1, Sheet2"`.

- `include` (optional): It’s the counterpart to exclude and allows you to submit the names of the sheets whose content (e.g., values, pictures, etc.) you want to send to the server. Like exclude, include accepts a comma-delimited string, e.g., `"Sheet1, Sheet2"`.

- `headers` (optional): A dictionary with name/value pairs that will be provided as HTTP request headers.

- `timeout` (optional): By default, the VBA integration has a timeout of 30s, you can change it by providing the timeout in milliseconds. E.g., for 40s, provide `timeout:=40000`.

- `auth` (optional): This will set the Authorization HTTP request header, see [](authentication.md).

Here is a complete example of how to provide a config along with your `RunRemotePython` call:

```vb.net
Sub Hello()
    Dim headers As New Dictionary
    headers.Add "key1", "value1"
    RunRemotePython "https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world", _
        auth:="xxx", _
        exclude:="Sheet1, Sheet2", _
        headers:=headers
End Sub
```
