# Changelog

## v0.4.1 (Jun 26, 2024)

* Upgraded xlwings-bootstrap to 5.3.3-1 and xlwings to 0.31.7

## v0.4.0 (Jun 25, 2024)

* Breaking change: replaced `XLWINGS_ENTRAID_VALIDATE_ISSUER` with `XLWINGS_AUTH_ENTRAID_MULTITENANT`
* Breaking change: renamed `XLWINGS_ENTRAID_CLIENT_ID` with `XLWINGS_AUTH_ENTRAID_CLIENT_ID` and `XLWINGS_ENTRAID_TENANT_ID` with `XLWINGS_AUTH_ENTRAID_TENANT_ID`
* Changed dependencies for validating the Entra ID JWT fro `PyJWT` to `joserfc`
* Allows to provide an own function for retrieving the Entra ID JWKS (JSON Web Key Set), allowing to enable the Entra ID auth functionality on airgapped servers
* Allow to use multiple auth providers on the backend. This is helpful if you want to use the same backend from Office.js via Entra ID and from Google Sheets via Google OAuth, for example.
* Enabling auth now requires to set `XLWINGS_AUTH_PROVIDERS`, e.g., `XLWINGS_AUTH_PROVIDERS=["entraid"]`
* Upgraded dependencies incl. xlwings to 0.31.6.

## v0.3.0 (Jun 18, 2024)

* Introduced `@script` decorator and `xw-click` HTML tag, see `app/custom_scripts/examples.py`.
* Introduced `app.utils.trigger_script()` to trigger a custom script from within a custom function, see `app/custom_functions/examples.py`.
* Bootstrap can now be disabled via `XLWINGS_ENABLE_BOOTSTRAP=false`.
* `python run.py` now runs locally without `certs`, which allows it to be used with VBA or Office Scripts (Office.js always require certs).
* Upgraded dependencies incl. xlwings to 0.31.5.

## v0.2.0 (Jun 4, 2024)

* New settings `XLWINGS_APP_PATH` and `XLWINGS_STATIC_URL_PATH` that allow to mount the app on a non root-path such as https://my.domain.com/app.
* New setting `XLWINGS_DATE_FORMAT` to override/fix the date format in custom functions.
* Upgraded xlwings to 0.31.4.

## v0.1.0 (May 27, 2024)

* First release.
