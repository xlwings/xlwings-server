# Debugging

## Server debugging

To run a debug server in VS Code, add the following file `.vscode/launch.json`:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "xlwings-server",
            "type": "debugpy",
            "request": "launch",
            "module": "xlwings_server.cli",
            "args": [],
            "console": "integratedTerminal",
            "justMyCode": false,
            "python": "${workspaceFolder}/.venv/bin/python",
            "env": {
                "PYTHONPATH": "${workspaceFolder}"
            },
            "cwd": "${workspaceFolder}"
        }
    ]
}
```

This allows you to start the debugger by pressing `F5`.

## Office.js add-in debugging

If you need to debug errors with Office.js add-ins, you need to open the developer tools of the browser engine that’s being used. Depending on the platform, the process is different:

- **Desktop Excel on Windows**: to open the DevTools, right-click on the task pane and select `Inspect`.

- **Desktop Excel on macOS**: to open Web Inspector, you’ll need to run the following command in a Terminal once:

  ```text
  defaults write com.microsoft.Excel OfficeWebAddinDeveloperExtras -bool true
  ```

  Then, after restarting Excel, right-click on the task pane and select `Inspect Element`.

  ```{note}
  After running this command, you might see an empty browser window when using other add-ins. To get rid of this, you would need to disable debugging again by running the same command in the Terminal with `false` instead of `true`.
  ```

- **Excel on the web**: open the developer tools of the browser you’re using. For example, in Chrome you can type `F12`.

Once you have the developer tools showing up, you usually want to look at the following tabs:

- **Console**: Here, you'll find any errors printed. If you use Excel on the web, you'll see a lot of error messages and warnings that are unrelated to the add-in though, so you'll need to watch out for relevant messages within the noise.
- **Network**: Here, you'll see if the browser has an issue with loading a specific file. You'll also be able to double-check the URL of the server and you are able to click on a file to see the content and its headers. Note, however, that you will need to have the Network tab open before making any requests (i.e., reload the add-in, click a button, or run a custom function).
