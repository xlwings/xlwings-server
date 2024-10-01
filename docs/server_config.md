# Server Config

The server is configured via either an `.env` file in the root of the repository or via environment variables. For each xlwings Server environment (`dev`, `qa`, `prod`, etc.), you should have an own `.env` file or set of environment variables.

## Available Settings

Please refer to the `.env` file, which is thoroughly commented. The `.env` file is created by running `python run.py init`. If you haven't done that yet, you can also look at [`.env.template`](https://github.com/xlwings/xlwings-server/blob/main/.env.template).

## Environment Variables

Instead of using a `.env` file, you can provide the settings via environment variables. If you are using a hosted solution, they are often called _secrets_.

## Backup

The `.env` file is ignored by Git as it may contain sensitive credentials. You should therefore back it up in a secure location such as a password manager.
