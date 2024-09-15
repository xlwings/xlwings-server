# VBA

You can either install the classic, VBA-based xlwings add-in or create standalone macro-enabled workbooks that do not depend on any add-in.

## xlwings add-in

1. Install the xlwings add-in locally by running `xlwings addin install` on a Terminal/Command Prompt.
2. Create a quick start project by running `xlwings quickstart myproject`.
3. Open the VBA editor via `Alt+F11` and paste the following code into a Module:

   ```vb.net
   Sub HelloWorld()
       RunRemotePython "https://YOUR_SERVER/xlwings/custom-scripts-call/hello_world"
   End Sub
   ```

   Make sure to replace `YOUR_SERVER` with the URL of your server and `hello_world` with the name of your custom script.

4. Run the `HelloWorld` macro in any way you want, e.g, by clicking into it and hitting `F5` or by adding a button to the sheet that you bind to this macro.

## Standalone workbooks

TODO
