# Config

xlwings Server can be configured via a `.env` file in the root of the repository or via environment variables.

## Available Settings

Please refer to the `.env` file, which is thoroughly commented. The `.env` file is created by running `python run.py init`. If you haven't done that yet, you can also look at [`.env.template`](https://github.com/xlwings/xlwings-server/blob/main/.env.template).

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
