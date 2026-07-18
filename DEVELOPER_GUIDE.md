# Developer Guide

## New package setup

Install xlwings-server in editable mode from another project:

```
uv pip install -e "xlwings-server[dev] @ ../xlwings-server"
```

## Run everything local

To get a prod-like setup while running the app locally, run the following in separate terminals:

- `docker compose -f tests/docker-compose.redis.yaml up`
- `uv run uvicorn xlwings_server.main:main_app --host 0.0.0.0 --port 8000 --reload --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem`
- `export XLWINGS_SOCKETIO_SERVER_APP=true && uv run uvicorn xlwings_server.main:sio_app --host 0.0.0.0 --port 8001 --reload --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem`

in `.env`:

```
XLWINGS_ENVIRONMENT="prod"
XLWINGS_ADD_SECURITY_HEADERS=false
XLWINGS_SOCKETIO_MESSAGE_QUEUE_URL=redis://localhost:6379/0
```

in `integrations/socketio.js`:

```js
socket = io("https://127.0.0.1:8001", {
  auth: async (callback) => {
    let token = await globalThis.getAuth();
    callback({
      token: token,
    });
  },
});
```

## Install the xlwings Python package from its repo into xlwings-server in editable mode

- xlwings-server: `pip uninstall xlwings`
- xlwings-server: `cd ../xlwings && python setup.py develop && cd ../xlwings-server`

## Build docs

From the root dir, run:

```
uv run sphinx-autobuild docs docs/_build/html  --port 9000 -E
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

After updating a package in `packages.json`, run `sudo npm install` — the `postinstall` hook (defined in `package.json`) automatically copies the relevant files into the static folder by running `scripts/postinstall.py`.

## Office.js

Unlike the other frontend dependencies, Office.js is **not** managed via npm. Microsoft froze the `@microsoft/office-js` package at `1.1.110` (April 2025) and now serves the library only from the CDN (`https://appsforoffice.microsoft.com/lib/1/hosted/`). Internet-connected add-ins load it from there (`XLWINGS_CDN_OFFICEJS=true`), but airgapped/self-hosted deployments need it vendored locally — that's what the `settings.cdn_officejs = false` branch in `templates/base.html` serves.

The vendored copy lives in `xlwings_server/static/vendor/office-js/<build>/` and is committed to the repo, so `npm install` does **not** touch it and a fresh checkout works offline out of the box. To refresh it to the current CDN build:

```
make officejs
```

This runs `scripts/mirror_officejs.py`, which downloads the curated (Excel-only, non-debug) set of files listed in `scripts/officejs_inventory.py`, fetches `LICENSE.md` from the [OfficeDev/office-js](https://github.com/OfficeDev/office-js) repo, versions the folder by the detected build (e.g. `16.0.20308.15050`), removes the previous build, and updates the Office.js `<script>` path in `base.html`. Add `--dry-run` (`uv run scripts/mirror_officejs.py --dry-run`) to preview without downloading.

Because the inventory is a fixed list, the mirror can't _see_ files it doesn't already ask for. The two drift cases:

- **A file is removed** from the CDN → the mirror fails with a 404 pointing at the offending path. Drop it from `scripts/officejs_inventory.py`.
- **New Excel bundles are added** (a new minor like `excel-web-16.01.js`, or a future major like `excel-17`) → these would be silently missed. Run `make officejs-check` (`uv run scripts/mirror_officejs.py --check`) to probe the CDN for Excel bundles beyond the inventory; it exits non-zero and lists any it finds. Add them to `scripts/officejs_inventory.py`, then re-mirror. Worth running periodically (e.g. in CI) so new bundles don't go unnoticed.

To otherwise rebuild the inventory after a big CDN change, run a mirror, then list the resulting tree (excluding `*.debug.js`, `office.d.ts`, `office-vsdoc.js`).

## CSP header

To use the most restrictive CSP header, set `XLWINGS_ENABLE_EXCEL_ONLINE=false` for local development.

## Prettier

The VS Code extension prettier requires to set the configuration to `.prettierrc.js` explicitly.

## Alert window

When debugging the alert/dialog window, you need to open up a separate instance of the dev tools.

## xlwings Wasm

For the offline usage of Pyodide, the following packages are always required to be copied over from the Pyodide release package:

- micropip
- packaging

## Script Lab

Script Lab: figuring out the exact syntax for Office.js is easiest done in the Script Lab add-in that can be installed via Excel's add-in store.
