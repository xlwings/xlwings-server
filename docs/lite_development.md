# xlwings Lite Development

xlwings Server acts as the development environment for xlwings Lite. So before anything else:

- Pick a development environment by following this guide: [](index_development_environment.md)
- And install the Office.js add-in by following this guide: [](install_officejs_addin.md)

## Settings

Now that you have xlwings Server running, you can make the switch to xlwings Lite by setting the following setting under `app/.env`:

```ini
XLWINGS_ENABLE_LITE=true
```

This will restart the uvicorn development server and reload the task pane. You should now see an yellow alert in the task pane that Python is loading. That's it, you are now running xlwings Lite in development mode!

## Custom functions and custom scripts

Custom functions and custom scripts have to be written in a different directory compared with xlwings Server:

- `app/lite/custom_functions`
- `app/lite/custom_scripts`

## Dependencies

You need to maintain a separate file for your dependencies under `app/lite/requirements.txt`. The requirements are installed automatically when you save the file, triggered by a task pane reload.

Pyodide first checks for a package in the Pyodide repository and if there is none, use PyPI directly. Pyodide can only load pure Python wheels or wasm32/emscripten wheels built by Pyodide.

This means that not all packages are supported, e.g., Polars doesn't work. Some packages may need to be built specifically for Pyodide if they aren't available yet and if they aren't pure Python packages, see [Creating a Pyodide package](https://pyodide.org/en/stable/development/new-packages.html). For a list of "complex" packages that are available for Pyodide, see [Packages built in Pyodide](https://pyodide.org/en/stable/usage/packages-in-pyodide.html).

By default, Pyodide will download the packages directly from their CDN (content deliver network). If you want to serve them from your own server, you need to copy the `.whl` files (the Python wheels) into the `app/static/vendor/pyodide` directory. You can download all available ones from their [GitHub release page](https://github.com/pyodide/pyodide/releases). The asset is called `pyodide-x.x.x.tar.bz2` and it needs to be from the correct Pyodide release. You can find the one used by xlwings Lite by looking at the console in the browser dev tools (right-click on the task pane and click `Inspect`) where it will be printed.

```{note}
For packages from the Pyodide repository, such as pandas or Matplotlib, you can't just freely set the version, but need to use whatever version their offering.
```

## Python version

The Python version is dictated by Pyodide, so you can't choose it. The current version is printed in the console of the browser dev tools (right-click on the task pane and click `Inspect`).

## Configuration

xlwings Lite is configured via `app/lite/.env`. Whenever you restart the server via `python run.py`, the required settings are copied from `app/.env` to `app/lite.env` (`XLWINGS_LICENSE_KEY` and `XLWINGS_ENABLE_EXAMPLES`). So unless you want to introduce you own settings, you don't have to edit the file manually.

```{note}
Even though `app/lite/.env` is ignored by Git, it will be included in your final xlwings Lite app and visible for everyone. xlwings developer keys will be replaced by deploy keys, that never expire.
```

To remain lightweight, xlwings Lite doesn't use `pydantic-settings` but only `python-dotenv`, see `app/lite/config.py`.
