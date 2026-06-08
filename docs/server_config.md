# Settings

xlwings Server can be configured via

- `.env` file in the root of the repository for sensitive settings during local development
- Environment variables for sensitive settings when deployed
- `pyproject.toml`, under `[tool.xlwings_server]` for settings that aren't sensitive and the same across all environments (e.g,. dev, prod, etc.).

## Using Settings in Code

- In templates, you access settings like so: `{{ settings.environment }}`, i.e., lower-case and without the leading `XLWINGS_`.
- In Python code, you have access to settings as follows:

  ```python
  from xlwings_server import settings

  settings.environment
  ```

## Custom Settings

To extend the built-in settings (see below) with your own, run the following command on a Terminal:

```
uv run xlwings-server add config
```

This adds the `config.py` file in the root of your repository, where you can add your own settings. Note that this uses [Pydantic Settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/).

## Built-in Settings

Please refer to the `.env` file, which is thoroughly commented. The `.env` file is created by running `uv run xlwings-server init`.

### Object handle settings

The caching of [object handles](custom_functions.md#object-handles) is configured via the following settings (all documented in the `.env` file):

- `XLWINGS_OBJECT_CACHE_URL`: the Redis/ValKey URL for the object cache. Required for production.
- `XLWINGS_OBJECT_CACHE_EXPIRE_AT`: a cron expression that determines when cached objects are purged (default: every Saturday at 12:00 PM UTC).
- `XLWINGS_OBJECT_CACHE_ENABLE_COMPRESSION`: whether to compress cached objects in Redis.
- `XLWINGS_OBJECT_CACHE_PARTITION_BY_USER`: by default, object handles are not tied to a specific user. This means that as long as an object is still cached, anyone can resolve it without recalculating—e.g., a colleague who opens a shared workbook can use its object handles right away. Set this to `true` on a shared backend with mutually untrusted users to scope object handles to the user who created them; this prevents one user from resolving another user's cached objects, at the cost of that convenience (other users then have to recalculate to populate their own cache). This requires [authentication](authentication.md): with partitioning enabled, object-handle calls from an unauthenticated user fail, since there's no user to scope the cache to.

## Edit the `.env` file

Most of the setting in the `.env` file are commented out (line starts with a `#` sign). This means that they use their default value, which is shown in the comment. To change a value, remove the the `#` and change the value accordingly. E.g., to disable the examples you edit the `.env` file from:

```ini
# XLWINGS_ENABLE_EXAMPLES=true
```

to:

```ini
XLWINGS_ENABLE_EXAMPLES=false
```

## Server Environments

A server environment is a separate installation of xlwings Server that serves a specific purpose. Each server environment requires an own `.env` file or set of environment variables. It is important to configure the name of the environment via `XLWINGS_ENVIRONMENT`. Allowed values are:

- `dev`: for development
- `qa`: a deployed version for testing
- `staging`: a deployed version for testing
- `uat`: a deployed version for testing
- `prod`: the deployed version that is used by the end-users in production

`qa`, `staging` and `uat` serve the same purpose, but different names are offered so that you can stick to the naming convention that you are used to.

Here's what happens based on the name of the server environment:

- The manifest under the `/manifest` endpoint shows the correct `Id`.
- Except for the `prod` environment, the manifest shows the environment name in the ribbon tab and appends it to the namespace of custom functions. This helps prevent any name clashes when you have the add-in installed for more than 1 environment or just switch between environments.
- The `dev` environment configures the server to automatically reload when the code changes and shows the details of _all_ Python exceptions in Excel.
- The `prod` environment only shows the details of `XlwingsError` exceptions and does append anything to the name of the ribbon or the name of the custom function namespace.

## Environment Variables

Instead of using a `.env` file, you can provide the settings via environment variables. If you are using a hosted solution, they are often called _secrets_. If you provide both an environment variable and a value in the `.env` file, the environment variable wins.

## Backup

The `.env` file is ignored by Git as it may contain sensitive credentials. You should therefore back it up in a secure location such as a password manager.
