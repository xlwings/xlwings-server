# xlwings Lite Limitations

If any of the following limits are unacceptable, you can always switch to xlwings Server with minimal efforts to get access to a full Python installation on the backend.

## Everything is Public

The most important thing to be aware of is that everything is public since the code runs on the end-user's machine. Most importantly this includes:

- The entire Python code
- Configuration from the `app/lite/.env` file (not from the `app/.env` file though, which is the configuration for xlwings Server)

To see exactly what the user has access to, inspect the `xlwings_lite_dist` folder after running the `python run.py lite` command.

## xlwings Limitations

Currently, the following xlwings Server features aren't supported yet, but are likely to be added in the future:

- `App.alert()`
- Object handles
- Streaming functions
- Error handling: ribbon buttons and sheet button currently don't handle errors, so use task pane buttons to call scripts.
- Custom functions and custom scripts either have to run via xlwings Server or xlwings Lite. I.e., you can't run some functions on the server and others locally on Wasm.

## PyScript/Pyodide Limitations

xlwings Lite uses PyScript, which is based on Pyodide, and comes with the following limitations:

- Not all packages are supported, e.g., Polars doesn't work. This is mainly because multithreading and multiprocessing aren't working. Other packages may need to be built specifically for Pyodide if they aren't available yet and if they aren't pure Python packages, see [Creating a Pyodide package](https://pyodide.org/en/stable/development/new-packages.html). For a list of "complex" packages that are available for Pyodide, see [Packages built in Pyodide](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)
- Imports: You can't import Python modules via relative imports
- Web APIs: you can use `requests` and `aiohttp` or `pyscript.fetch()`, but not `httpx`. Often, you'll run into CORS issues though as the server needs to explicitly allow access via headers. GitHub works though so you can access files from there. Otherwise, you could use a CORS proxy (preferably owned by you) to work around this issue if you have no control over the web server.
- TCP/IP connections: No support, i.e., no direct connections to databases like PostgreSQL is possible. However, SQLite is supported.
- Since Python runs in the browser, you don't have access to the local file system, but you could easily build a file uploader via the task pane or access them via web API.

See the [Pyodide docs](https://pyodide.org/en/stable/usage/wasm-constraints.html) for further details.
