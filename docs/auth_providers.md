# Other Auth Providers

In addition to [](auth_entraid.md), xlwings Server supports various authentication providers, including custom ones, which are described here.

## Custom authentication

1. Config: To use your own authentication method, activate the `custom` authentication provider:

   ```ini
   XLWINGS_AUTH_PROVIDERS=["custom"]
   ```

2. Server: To make this work on the backend, you need to implement the `validate_token` function under [`app/auth/custom/__init__.py`](https://github.com/xlwings/xlwings-server/blob/main/app/auth/custom/__init__.py).

3. Integration: On the frontend, you need to provide the token depending on your integration:

   - **Office.js add-ins**: Adjust `globalThis.getAuth` under [`app/static/auth.js`](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/auth.js) so that it returns the token that you will validate with the `validate_token` function on the backend.
   - **Other integrations**: provide the token via the `auth` config, see your specific integration for more details: [Office.js Add-ins](officejs_run_scripts.md), [](vba_integration.md), [](googleappsscript_integration.md), or [](officescripts_integration.md).

## Google OAuth2 (SSO)

TODO
