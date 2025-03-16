# Authentication Introduction

This page gives you an introduction to the core concepts, including authentication, authorization, and the user model.

## Authentication vs. Authorization

Authentication answers the question, "Who is the user?" while [authorization](authorization.md) determines, "Does the authenticated user have the required rights?".

## Enable authentication

By default, there is no authentication provider configured (`XLWINGS_AUTH_PROVIDERS=[]`) and everyone will be able to run custom functions and custom scripts. The current user object will be `User(id='n/a', name='Anonymous', email=None, domain=None, roles=[])`.

To enable authentication, you need to set `XLWINGS_AUTH_PROVIDERS` in the [](server_config.md). xlwings Server will then authenticate calls to [Custom Functions](custom_functions.md) and [Custom Scripts](custom_scripts.md) using the specified authentication provider.

You can enable [](auth_entraid.md) or one of the [](auth_providers.md), including your custom authentication provider.

```{caution}
Setting up an authentication provider requires users to be logged in to run [Custom Functions](custom_functions.md) or [Custom Scripts](custom_scripts.md) but it doesn't automatically lock down then task pane, see [](#task-pane-authentication).
```

## Current user object

At the core of the authentication system is the `User` model. You can find it under [`app/models/user.py`](https://github.com/xlwings/xlwings-server/blob/main/app/models/user.py) and it is introduced in more detail under [](authorization.md#custom-user-model).

If you need access to the current user object from a custom script or a custom function, you can use a function parameter with the type hint `CurrentUser`:

```python
from ..models import CurrentUser

@func
def my_function(current_user: CurrentUser):
    return f"The user's name is {current_user.name}"
```

## Task pane authentication

Since the task pane is completely customizable, it is your responsibility to lock down the desired endpoints:

- The landing page of the task pane needs to be publicly available
- The rest of the pages can be locked down using the `User` dependency injection. Note that within FastAPI endpoints, you use the `dependencies.User` dependency---`models.CurrentUser` is only available with [](custom_functions.md) and [](custom_scripts.md).
- You will need to provide the `Authorization` header with every request. For `htmx`, there is a sample included under [`app/templates/examples/auth`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/auth).
