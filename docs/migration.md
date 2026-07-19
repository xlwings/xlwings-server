# Migrate to xlwings Server 1.0

This guide is for existing users upgrading from pre-1.0 versions. If you're new to xlwings Server, follow the [Quickstart](quickstart.md) instead.

Starting with v1.0, xlwings Server is distributed as a standard Python package instead of requiring you to work directly in the xlwings-server Git repository. This leads to the following improvements:

- Proper support for `uv` package manager, but flexibility to use `pip` or others if preferred
- No more Git merge conflicts (update via `uv` or `pip`)
- Simpler project structure with only the files you need
- Package integrity verification via PyPI file hashes

Other key changes:

- Python 3.10 is now the minimal supported version
- Run the server via `uv run xlwings-server` instead of `python run.py`
- `pyproject.toml` can now be used to configure the application in addition to `.env` and environment variables, see [](server_config.md). This is helpful for settings that are non-sensitive and the same across environments.

## Migration

To allow for a clean migration, we leave the legacy project untouched and work with a new project.

1. Install [uv](https://docs.astral.sh/uv/), Python's modern package manager. Run the following commands on a Terminal:

   ::::{tab-set}

   :::{tab-item} Windows

   ```bash
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

   :::
   :::{tab-item} macOS and Linux

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   :::

   ::::

2. Create a new uv project (I'll be calling it `myproject` here) and change into the directory (replace `3.14` with the Python version that you're currently using):

   ```text
   uv init --python=3.14 myproject
   cd myproject
   ```

3. Install `xlwings-server` and `watchfiles` (for hot-reloading), then initialize xlwings-server:

   ```bash
   uv add xlwings-server
   uv add watchfiles --dev
   uv run xlwings-server init .
   ```

4. Run the migration command from your new project directory:

   ```text
   uv run xlwings-server migrate C:\path\to\old-project
   ```

Run the server to see if it starts correctly:

```
uv run xlwings-server
```

Stop the server again and go through the following list to migrate the additional items that affect you.

## Additional Migration Steps

- If your old project had application-specific dependencies in `requirements.in`, add them to your new project's `pyproject.toml` by running `uv add <package>` for each one (or by editing the `dependencies` list in `pyproject.toml` directly). Dependencies are no longer managed via `requirements.in`/`requirements.txt`.
- If you have custom static files other than `css/style.css`, `js/main.js`, and `images/`, copy them over from `app/static` to `static`.
- If you use Azure functions for deployment, run: `uv run xlwings-server add azure functions`, then copy over `local.settings.json` from your old to your new project. Note that Azure functions require a traditional `requirements.txt` file in the root of your project. If you use `uv`, run the following command before deploying (ideally, this is done automatically as part of your CI/CD pipeline): `uv export --format requirements.txt -o requirements.txt`.
- If you are using a custom `User` model: Run `uv run xlwings-server add model user`, then add back the logic from `app/models/user.py` to `models/user.py`. Note, there's no need to inherit from `BaseUser` anymore and the model has been simplified (no more properties).
- If you were using custom configuration in `app/config.py`, run `uv run xlwings-server add config` and edit `config.py` accordingly.
- If you are using custom authentication, copy `app/auth/custom/__init__.py` to `/auth/custom/__init__.py` and `app/static/js/auth.js` to `static/js/auth.js`.
- If you have custom FastAPI endpoints (e.g., added to `app/routers/taskpane.py`), run `uv run xlwings-server add router` and add them to `routers/custom.py`.
- If you relied on FastAPI lifespan event logic, run `uv run xlwings-server add lifespan` and move it into the generated `lifespan.py`.
- If you have customized `app/auth/entraid/jwks.py`, run `uv run xlwings-server add auth entraid` and replace the function in `auth/entraid/jwks.py` with that from `app/auth/entraid/jwks.py`.
- If you use custom `User` models, authentication, or custom endpoints, make sure to change the imports into these:
  - `from xlwings_server.models import CurrentUser`
  - `from xlwings_server.dependencies import User`
  - `from xlwings_server.templates import TemplateResponse`
  - `from xlwings_server import settings`
