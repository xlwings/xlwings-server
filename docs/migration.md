# Migrate to xlwings Server 1.0

This guide is for existing users upgrading from pre-1.0 versions. If you're new to xlwings Server, follow the [Quickstart](quickstart.md) instead.

Starting with v1.0, xlwingis Server is now distributed as a standard Python package instead of requiring you to work directly in the xlwings-server Git repository.

This leads to the following improvements:

- Simple updates via `uv` or `pip` (no Git merge conflicts)
- Simpler project structure with only the files you need
- Package integrity verification via PyPI file hashes
- Proper support for `uv` package manager, but flexibility to use `pip` or others if preferred

Other key changes:

- Python 3.10 is now the minimal supported version
- Run the server via `uv run xlwings-server` instead of `python run.py`
- `pyproject.toml` can now be used to configure the application in addition to `.env` and environment variables, see [](server_config.md)

The migration requires one-time project restructuring. The changes below outline what's different in 1.0:

1. Follow the [](quickstart.md)
2. Replace the content of `custom_functions/` and `custom_scripts/` with the content of your old `app/custom_functions/` and `app/custom_scripts/`, respectively.
3. Copy over the certificates from `certs/` to the same folder.
4. Overwrite the UUIDs in `pyproject.toml` under `[tools.xlwings_server]` with those from `app/config.py`.
5. Replace the `.env` file with the `.env` from the old project
6. Copy `app/templates/manifest.xml` to `templates/manifest.xml`
7. Run the server: `uv run xlwings-server`.

Depending on how much you have customized, continue adding optional components:

- If your `app/static/css/style.css` isn't empty, copy it to `static/css/style.css`
- If your `app/static/js/main.js` isn't empty, copy it to `static/js/main.js`
- If you have other custom static files, copy them over from `app/static` to `static` into the respective subdirectory, e.g., `images`, `js`, `css`.
- If you have custom templates, copy them over from `app/templates` to `templates`.
- To support Azure functions: `uv run xlwings-server add azure functions`, then copy over `local.settings.json`
- To implement your own `User` model: `uv run xlwings-server add model user`, then add back the logic from `app/models/user.py` to `models/user.py`. There's no need to inherit from `BaseUser` anymore and the model has been simplified.
- If you want an empty task pane, you can simply delete `templates/taskpane.html`
- If you were using custom configuration, run `uv run xlwings-server add config` and edit `config.py`.
- If you are using custom authentication, copy `app/auth/custom/__init__.py` to `/auth/custom/__init__.py` and `app/static/js/auth.js` to `static/js/auth.js`.
- If you have custom FastAPI endpoints, run `uv run xlwings-server add router` and add them to `routers/custom.py`.
- If you have customized `app/auth/entraid/jwks.py`, run `uv run xlwings-server add auth entraid` and replace the function in `auth/entraid/jwks.py` with that from `app/auth/entraid/jwks.py`.
- You may need to update import statements as follows:
  - `from xlwings_server.models import CurrentUser`
  - `from xlwings_server.dependencies import User`
  - `from xlwings_server.templates import TemplateResponse`
  - `from xlwings_server import settings`
