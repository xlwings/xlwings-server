# Run everything local

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

# Install the xlwings Python package from its repo into xlwings-server in editable mode

- xlwings: delete `project.toml` temporarily
- xlwings: replace `version = "dev"` with the version from `xlwings.js`
- xlwings-server: `pip uninstall xlwings`
- xlwings-server: `cd ~/dev/xlwings && python setup.py develop`
- xlwings: undo deletion of `project.toml`

# Build docs

From the root dir, run:

```
sphinx-autobuild docs docs/_build/html  --port 9000
```

The requirements are currently under `docs/requirements.txt` and have not been included in `requirements-dev.txt` as there's an incompatibility with Python 3.9.
