# Developer Guide

## Run everything local

To get a prod-like setup while running the app locally, run the following in separate terminals:

- `docker compose -f tests/docker-compose.redis.yaml up`
- `uvicorn app.main:main_app --host 0.0.0.0 --port 8000 --reload --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem`
- `export XLWINGS_SOCKETIO_SERVER_APP=true && uvicorn app.main:sio_app --host 0.0.0.0 --port 8001 --reload --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem`

in `.env`:

```
XLWINGS_ENVIRONMENT="prod"
XLWINGS_ADD_SECURITY_HEADERS=false
XLWINGS_SOCKETIO_MESSAGE_QUEUE_URL=redis://localhost:6379/0
```

in `socketio-handlers.js`:

```js
globalThis.socket = io("https://127.0.0.1:8001", {
  auth: async (callback) => {
    let token = await globalThis.getAuth();
    callback({
      token: token,
    });
  },
});
```

## Install the xlwings Python package from its repo into xlwings-server in editable mode

- xlwings: delete `project.toml` temporarily
- xlwings: replace `version = "dev"` with `0.0.0`
- xlwings-server: `pip uninstall xlwings`
- xlwings-server: `cd ~/dev/xlwings && python setup.py develop`
- xlwings: undo deletion of `project.toml`

## Build docs

From the root dir, run:

```
sphinx-autobuild docs docs/_build/html  --port 9000 -E
```

The requirements are currently under `docs/requirements.txt` and have not been included in `requirements-dev.txt` as there's an incompatibility with Python 3.9.

## Upgrade npm dependencies

Node.js isn't required to run the app as the relevant files are copied over from `node_modules` to `app/static/vendor`. It is, however required to upgrade the packages:

1. Install Node.js
2. `sudo npm install`

Update a package:

```
npm install mypackage@latest
```

Or use the VS Code extension `Version Lens`, which allows you to update the packages directly from `packages.json` (click the `V` at the top right).

After updating a package in `packages.json`, run `sudo npm upgrade` followed by:

```
python scripts/copy_node_modules_to_static_folder.py
```

to copy over the files to the static folder.

## CSP header

To use the most restrictive CSP header, set `XLWINGS_ENABLE_EXCEL_ONLINE=false` for local development.

## Prettier

The VS Code extension prettier requires to set the configuration to `.prettierrc.js` explicitly.

## Alert window

When debugging the alert/dialog window, you need to open up a separate instance of the dev tools.

## xlwings Lite (Wasm)

For the offline usage of Pyodide, the following packages are always required to be copied over from the pyodide release package:

- micropip
- packaging

## Script Lab

Script Lab: figuring out the exact syntax for Office.js is easiest done in the Script Lab add-in that can be installed via Excel's add-in store.
