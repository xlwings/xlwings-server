# Other Auth Providers

In addition to [](auth_entraid.md), xlwings Server supports various authentication providers, including custom ones, which are described here.

## Custom Authentication

To use your own authentication method, run the following command:

```
uv run xlwings-server add auth custom
```

This will add `auth/custom/__init__` and `static/js/auth.js`. The command also activates the `custom` authentication provider in the `.env` file:

```ini
XLWINGS_AUTH_PROVIDERS=["custom"]
```

- For the backend, implement the `validate_token` function in `auth/custom/__init__`.

- For the frontend, you need to provide the token by editing `globalThis.getAuth` under `static/js/auth.js` so that it returns the `token` and `provider` that you will validate with the `validate_token` function on the backend:

  ```js
  globalThis.getAuth = async function () {
    return {
       token: "test-token",  // TODO: implement
       provider: "custom",
    };
  };
  ```

  **Other integrations**: provide the token via the `auth` config, see your specific integration for more details: [](vba_integration.md), [](googleappsscript_integration.md), or [](officescripts_integration.md).
