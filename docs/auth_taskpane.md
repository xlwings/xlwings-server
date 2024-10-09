# Task pane Authentication

By setting `XLWINGS_AUTH_PROVIDERS` in the [](server_config.md), xlwings Server will authentication calls to [](custom_functions.md) and [](custom_scripts.md). Since the task pane is completely customizable, it is your responsibility to lock down the desired endpoints:

- The landing page of the task pane needs to be publicly available
- The rest of the pages can be locked down using the `User` dependency injection
- You will need to provide the `Authorization` header with every request. For `htmx`, there is a sample included under [`app/templates/examples/auth`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/auth).
