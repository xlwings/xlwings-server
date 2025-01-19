# Changelog

## 0.10.2 (Jan 19, 2025)

- Fixed another issue with multi-range named ranges that caused `This operation is not permitted for the current object` error.

## 0.10.1 (Jan 17, 2025)

- Fixed an issue with sheet-scoped named formulas that were causing the following error message: `This operation is not permitted for the current object`.

## 0.10.0 (Jan 9, 2025)

- Datetime fixes both with custom scripts (day and month were misinterpreted with certain locales) and custom functions (the formatting of dates in custom functions now respects the specific format chosen on the system).
- Added the `-e`/`--env` arg to the lite CLI command.
- Upgraded dependencies incl. xlwings to 0.33.6.

## 0.9.2 (Dec 9, 2024)

- Custom functions reloading (introduced with 0.9.1) is now only done during development.
- Fixed an issue with the `manifest.xml` when there was no function namespace used in the `prod` environment.

## 0.9.1 (Dec 8, 2024)

- Custom functions are now automatically reloaded every time you edit them without having to restart Excel or reloading the add-in.
- Fixed path handling issues on Windows with `run.py` CLI and `.env`. This fixes issues with `run.py init`, dev server reloading, and loading `.env`.
- Office.js API versions are now printed in the dev tools console.
- Upgraded dependencies.

## 0.9.0 (Nov 27, 2024)

- Launched xlwings Lite, allowing Python-based Office.js add-ins to be deployed as static websites. These add-ins run Python via WebAssembly (Wasm) in the add-in's browser engine, so Python doesn't need to be installed on neither the server nor the local machine. Learn more at [xlwings Lite](index_lite.md).
- The `XLWINGS_PUBLIC_ADDIN_STORE` setting is deprecated in favor of `XLWINGS_CDN_OFFICEJS`.
- More script examples: show an error in the task pane and show a Matplotlib plot.
- Upgraded dependencies incl. xlwings to 0.33.4.

## 0.8.0 (Nov 8, 2024)

- The `XLWINGS_APP_PATH` settings has been improved to be independent of a specific setup of an external service such as nginx.
- Enhanced `TemplateResponse` by making the `context` argument optional and by providing `settings` behind the scenes.
- New task pane docs, additionally covering Jinja, Bootstrap, and Alpine.js.
- Breaking change: If you were using `XLWINGS_APP_PATH` in connection with nginx, you'll have to adjust your nginx config in line with [`nginx/nginx-apppath.conf`](https://github.com/xlwings/xlwings-server/blob/main/nginx/nginx-apppath.conf).

## 0.7.0 (Oct 29, 2024)

- The task pane can now interact with the Excel object model via htmx, see the [docs](https://server.xlwings.org/en/latest/htmx/).
- Added a favicon to silence an error in the dev tools console (Windows).
- Tests now additionally run with Python 3.13.
- Moved Office.js JavaScript code from xlwings to xlwings-server.
- Bug fix: Object handles now also work with varargs.
- Upgraded dependencies.

## 0.6.3 (Oct 23, 2024)

- Bug fix: Fixed Jinja templates rendering to ensure content escaping.

## 0.6.2 (Oct 21, 2024)

- Function-specific RBAC: you can now use `required_roles=["role1", "role2"]` inside `@script` or `@func` decorators.
- Code that uses the Alpine.js CSP build can now be registered in a simplified way by calling `registerAlpineComponent("name", function)`. Also added an Alpine.js CSP build example.
- Bug fix: object handles with 1-dimensional NumPy arrays are now fixed.
- Bug fix: removed inline style in sample task pane to be CSP header compliant.
- Upgraded dependencies incl. xlwings to 0.33.3.

## 0.6.1 (Oct 11, 2024)

- Enhanced the task pane buttons that use the `xw-click` tag: they are now disabled and show a spinner while the request is in progress. Also, errors are now shown at the top of the task pane instead of via alert window.
- Changed the `<Version>` tag in the manifest to have the format `x.x.x.x` instead of `x.x.x`. This might resolve issues with custom functions.
- Put manifest.xml template on `.gitattributes` with the git merge strategy `ours`.
- Upgraded dependencies incl. xlwings to 0.33.2.

## 0.6.0 (Oct 1, 2024)

- Support buttons on sheets with Office.js add-ins.
- Upgraded dependencies incl. xlwings to 0.33.1.

## 0.5.6 (Sep 25, 2024)

- Object handles: added support for nested custom types, e.g., dicts containing pandas DataFrames.
- Added an example that shows how to handle authentication with the task pane via htmx.

## 0.5.5 (Sep 23, 2024)

- Added a button to the default task pane to set up a sheet with custom functions examples.
- Introduced dedicated docs at https://server.xlwings.org.
- `docker compose up` now also works without dev certificates
- Fixed a CORS issue when using the Office Scripts integration.
- Upgraded dependencies incl. xlwings to 0.33.0.

## 0.5.4 (Sep 11, 2024)

- Fixed security headers so that Windows will show the icons on the ribbon correctly.
- Made the HTTP port configurable in the default Dockerfile.
- Upgraded dependencies incl. xlwings to 0.32.2.

## 0.5.3 (Aug 24, 2024)

- Avoid merge conflicts in `requirements` files when merging in upstream.

## 0.5.2 (Aug 24, 2024)

- Upstream GitHub Actions pipelines have been disabled on forks.
- Simplified dependency management by getting rid of separate Windows `requirements` files.

## 0.5.1 (Aug 20, 2024)

- Custom functions and custom scripts can now access the current user object by using a function parameter with the `CurrentUser` as type hint, see examples.
- Custom functions now work with thousands of concurrent requests.
- Upgraded dependencies incl. xlwings to 0.32.1.

## 0.5.0 (Aug 15, 2024)

- Added support for object handles: https://docs.xlwings.org/en/latest/pro/server/officejs_custom_functions.html#object-handles
- Added `staging` as additional environment name.
- Dependencies are now split up into `requirements-core.in`, `requirements-dev.in`, and `requirements.in` and managed via `python run.py deps`, see README.
- Added docker-compose production configuration under `docker` directory including Socket.IO and Redis services.
- More custom function examples.
- Bug fix: socket.io service now respects the `XLWINGS_APP_PATH`.
- Added `XLWINGS_SECRET_KEY` setting.
- Upgraded dependencies incl. xlwings to 0.32.0.

## 0.4.4 (Jul 11, 2024)

- Fixed an issue with custom functions when using the setting `XLWINGS_ENABLE_SOCKETIO=false`.
- Upgraded xlwings to 0.31.10.

## 0.4.3 (Jul 9, 2024)

- Fixed `utils.trigger_script()` to only trigger the script 1x no matter how many times the file is open.
- There is now an official Docker image available: https://hub.docker.com/repository/deployment/xlwings/xlwings-server
- Open Office.js alerts are now closed before showing a new alert, which would otherwise cause an error.
- Custom functions now show errors that happen outside the app, such as timeouts.
- Upgraded dependencies incl. xlwings to 0.31.9.

## 0.4.2 (Jul 3, 2024)

- If you set a valid license key as `XLWINGS_DEVELOPER_KEY` env var in your build env, building the docker container via `docker compose build` will automatically install a deploy key inside the container.
- Fixed an issue when running the app with `XLWINGS_ENABLE_EXAMPLES=false`.
- Upgraded dependencies incl. xlwings to 0.31.8.

## 0.4.1 (Jun 26, 2024)

- Upgraded xlwings-bootstrap to 5.3.3-1 and xlwings to 0.31.7

## 0.4.0 (Jun 25, 2024)

- Breaking change: replaced `XLWINGS_ENTRAID_VALIDATE_ISSUER` with `XLWINGS_AUTH_ENTRAID_MULTITENANT`
- Breaking change: renamed `XLWINGS_ENTRAID_CLIENT_ID` with `XLWINGS_AUTH_ENTRAID_CLIENT_ID` and `XLWINGS_ENTRAID_TENANT_ID` with `XLWINGS_AUTH_ENTRAID_TENANT_ID`
- Changed dependencies for validating the Entra ID JWT fro `PyJWT` to `joserfc`
- Allows to provide an own function for retrieving the Entra ID JWKS (JSON Web Key Set), allowing to enable the Entra ID auth functionality on airgapped servers
- Allow to use multiple auth providers on the backend. This is helpful if you want to use the same backend from Office.js via Entra ID and from Google Sheets via Google OAuth, for example.
- Enabling auth now requires to set `XLWINGS_AUTH_PROVIDERS`, e.g., `XLWINGS_AUTH_PROVIDERS=["entraid"]`
- Upgraded dependencies incl. xlwings to 0.31.6.

## 0.3.0 (Jun 18, 2024)

- Introduced `@script` decorator and `xw-click` HTML tag, see `app/custom_scripts/examples.py`.
- Introduced `app.utils.trigger_script()` to trigger a custom script from within a custom function, see `app/custom_functions/examples.py`.
- Bootstrap can now be disabled via `XLWINGS_ENABLE_BOOTSTRAP=false`.
- `python run.py` now runs locally without `certs`, which allows it to be used with VBA or Office Scripts (Office.js always require certs).
- Upgraded dependencies incl. xlwings to 0.31.5.

## 0.2.0 (Jun 4, 2024)

- New settings `XLWINGS_APP_PATH` and `XLWINGS_STATIC_URL_PATH` that allow to mount the app on a non root-path such as https://my.domain.com/app.
- New setting `XLWINGS_DATE_FORMAT` to override/fix the date format in custom functions.
- Upgraded xlwings to 0.31.4.

## 0.1.0 (May 27, 2024)

- First release.
