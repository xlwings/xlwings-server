# Authorization and RBAC

_Authentication_ answers the question, "Who is the user?" while _authorization_ determines, "Does the authenticated user have the required rights?".

By adding an authentication provider via `XLWINGS_AUTH_PROVIDERS`, only logged in users will be able to call [](custom_functions.md) and [](custom_scripts.md). However, if you want to further differentiate between users, you need to implement authorization, either on a global level or for specific custom functions or custom scripts.

## Global authorization

To add global authorization, you can implement the `User.is_authorized()` method under [`app/models/user.py`](https://github.com/xlwings/xlwings-server/blob/main/app/models/user.py). For example, to only allow users with the domain `mydomain.com` to run custom scripts and custom functions, you could do:

```python
async def is_authorized(self):
    return self.domain == "mydomain.com" if self.domain else False
```

For role-based access control (RBAC), to only authorize users with certain roles, you could write:

```python
async def is_authorized(self):
    return await self.has_required_roles(["xlwings.user", "db.writer"])
```

## Function-specific authorization

If you have specific custom functions or custom scripts where you require specific roles, you can request them like so:

```python
import xlwings as xw

@script
async def hello_world(book: xw.Book, current_user: CurrentUser):
    required_roles = ["role1", "role2"]
    if not await current_user.has_required_roles(required_roles):
        raise xw.XlwingsError(f"Auth error: required roles: {', '.join(required_roles)}")
    ...
```
