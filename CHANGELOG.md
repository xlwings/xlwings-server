# Changelog

## v0.3.0 (Jun 18, 2024)

* Introduced `@script` decorator and `xw-click` HTML tag, see `app/custom_scripts/examples.py`.
* Introduced `app.utils.trigger_script()` to trigger a custom script from within a custom function, see `app/custom_functions/examples.py`.
* Bootstrap can now be disabled via `XLWINGS_ENABLE_BOOTSTRAP=false`.
* `python run.py` now runs locally without `certs`, which allows it to be used with VBA or Office Scripts (Office.js always require certs).
* Upgraded all dependencies incl. xlwings to 0.31.5.

## v0.2.0 (Jun 4, 2024)

* New settings `XLWINGS_APP_PATH` and `XLWINGS_STATIC_URL_PATH` that allow to mount the app on a non root-path such as https://my.domain.com/app.
* New setting `XLWINGS_DATE_FORMAT` to override/fix the date format in custom functions.
* Upgraded xlwings to 0.31.4.

## v0.1.0 (May 27, 2024)

* First release.
