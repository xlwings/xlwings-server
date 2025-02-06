# xlwings Lite Development

xlwings Server acts as the development environment for xlwings Lite. So before anything else:

- Pick a development environment by following this guide: [](index_development_environment.md)
- Install the Office.js add-in by following this guide: [](install_officejs_addin.md#sideloading)

## Switch to xlwings Lite

Now that you have xlwings Server running, you can make the switch to xlwings Lite by setting the following setting under `.env`:

```ini
XLWINGS_ENABLE_LITE=true
```

Start or restart your development server by running `python run.py`. You should now see a yellow alert in the task pane that Python is loading. That's it, you are now running xlwings Lite in development mode!

## Custom functions and custom scripts

You write your custom functions and custom scripts in the following directories:

- `app/custom_functions`, see [](custom_functions.md)
- `app/custom_scripts`, see [](custom_scripts.md)

## Python version

The Python version is dictated by Pyodide, so you can't choose it. The current version is printed in the console of the browser dev tools (right-click on the task pane and click `Inspect`).

If you're on macOS, this requires you to run the following command first in the Terminal:

```
defaults write com.microsoft.Excel OfficeWebAddinDeveloperExtras -bool true
```

see [](debugging.md#officejs-add-in-debugging) for more details.

## Dependencies

You need to define your dependencies under `app/lite/requirements.txt`. Note that this is a seperate file and different from the xlwings Server `requirements.txt`, which lives in the root of the xlwings-server repo. The requirements are installed automatically when you save the file, triggered by a task pane reload.

Pyodide first checks PyPI for a compatible package in the `whl` format. If it doesn't find a compatible version (it needs to be a pure Python package), Pyodide checks their own repository where they host compatible wheels for many popular packages that aren't pure-Python packages.

This means that not all packages are supported, e.g., Polars doesn't work. For a list of non-pure Python packages that are available for Pyodide, see [Packages built in Pyodide](https://pyodide.org/en/stable/usage/packages-in-pyodide.html). To build a new non-pure Python package for use with Pyodide, see [Creating a Pyodide package](https://pyodide.org/en/stable/development/new-packages.html).

By default, Pyodide will download the packages directly from their CDN (content deliver network). If you want to serve them from your own server, you need to copy the `.whl` files (the Python wheels) into the `app/static/vendor/pyodide` directory and reference them explicitly in `requirements.txt` via their path like so: `/static/vendor/pyodide/mypackage.whl`. You can download all available packages from their [GitHub release page](https://github.com/pyodide/pyodide/releases). The asset is called `pyodide-x.x.x.tar.bz2` and it needs to be from the correct Pyodide release. You can find the one used by xlwings Lite by looking at the console in the browser dev tools (right-click on the task pane and click `Inspect`) where it will be printed. You will also need to set `XLWINGS_CDN_PYODIDE=false` under `.env`.

```{note}
For packages from the Pyodide repository, such as pandas or Matplotlib, you can't just freely set the version, but need to use whatever version Pyodide is offering.
```

## Configuration

xlwings Lite reads the configuration from `app/lite/.env`. This file is automatically updated from `.env` whenever you kill/restart the server via `python run.py`.

To remain lightweight, xlwings Lite doesn't use `pydantic-settings` but only depends on `python-dotenv`, see `app/lite/config.py`.

```{note}
Even though `app/lite/.env` is ignored by Git, it will be included in your final xlwings Lite app and visible for everyone. However, xlwings developer keys are replaced by deploy keys when using the xlwings Lite build command.
```

## Debugging

xlwings Lite uses Pyodide under the hood, which don't offer a debugger. So to debug your custom functions and custom scripts, you have two options:

- Use `print()`, which will print to the console of the browser dev tools (not to the terminal where you run Python!).
- In `.env`, temporarily switch back to `XLWINGS_ENABLE_LITE=false`. This allows you to run `run.py` by using the debug mode of your editor and set breakpoints.

## Task Pane

If you want to deploy your xlwings Lite add-in as a simple static website, you are naturally restricted in what you can do with your task pane. For example, you wouldn't be able to use anything with backend dependency such as [](htmx.md). You could, however keep on using [](alpinejs).
