# Authorization and RBAC

_Authentication_ answers the question, "Who is the user?" while _authorization_ determines, "Does the authenticated user have the required rights?".

By adding an authentication provider via `XLWINGS_AUTH_PROVIDERS`, only logged in users will be able to call [](custom_functions.md) and [](custom_scripts.md).

If you want to further differentiate between users, you need to implement authorization, either on a global level or for specific custom functions or custom scripts. You can do this by using _role-based access-control_ (RBAC), which allows you to restrict access to only users who possess the required roles.

## Function-specific RBAC

If you have individual custom functions or custom scripts where you want to require specific roles, you can use `required_roles` like so:

```python
import xlwings as xw
from xlwings import script, func

@script(required_roles=["xlwings.admin", "xlwings.user"])
def myscript(book: xw.Book):
    ...

@func(required_roles=["xlwings.admin", "xlwings.user"])
def myfunction(name: str):
    ...
```

If you have set up Entra ID to provide roles (see [](auth_entraid.md#entra-id-roles)), that's all that's needed.

## Custom User Model

To customize how xlwings Server performs authorization, you can implement your own `User` model. On a Terminal, run:

```
uv run xlwings-server add model user
```

This will add the file `models/user.py` where you can edit or replace the User model to fit your needs. By default, the user model is set up as a [Pydantic](https://docs.pydantic.dev) model, but you could also implement it as a `dataclass` or as an SQLAlchemy model, etc.

## Global authorization

To add global authorization, you can implement the `User.is_authorized()` method in the User model. For example, if you have set `XLWINGS_AUTH_ENTRAID_MULTITENANT=true` but only want to allow users with the domain `mydomain.com` to run custom scripts and custom functions, you could do:

```python
class User(BaseUser):
    async def is_authorized(self):
        return self.domain == "mydomain.com" if self.domain else False
```

Or, for role-based access control (RBAC), i.e., only authorize users with certain roles, you could write:

```python
class User(BaseUser):
    async def is_authorized(self):
        return await self.has_required_roles(["xlwings.admin", "xlwings.user"])
```
