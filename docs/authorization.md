# Authorization and RBAC

_Authentication_ answers the question, "Who is the user?" while _authorization_ determines, "Does the authenticated user have the required rights?".

By adding an authentication provider via `XLWINGS_AUTH_PROVIDERS`, only logged in users will be able to call [](custom_functions.md) and [](custom_scripts.md).

If you want to further differentiate between users, you need to implement authorization, either on a global level or for specific custom functions or custom scripts. You can do this by using _role-based access-control_ (RBAC), which allows you to define roles that can be enforced globally or for specific custom functions/custom scripts.

## Global authorization

To add global authorization, you can implement the `User.is_authorized()` method under [`app/models/user.py`](https://github.com/xlwings/xlwings-server/blob/main/app/models/user.py). For example, if you have set `XLWINGS_AUTH_ENTRAID_MULTITENANT=true` but only want to allow users with the domain `mydomain.com` to run custom scripts and custom functions, you could do:

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

## Function-specific RBAC

If you have individual custom functions or custom scripts where you want to require specific roles, you can use `required_roles` like so:

```python
import xlwings as xw
from xlwings.server import script, func

@script(required_roles=["xlwings.admin", "xlwings.user"])
def myscript(book: xw.Book):
    ...

@func(required_roles=["xlwings.admin", "xlwings.user"])
def myfunction(name: str):
    ...
```

## Custom roles logic

Many identity providers (such as Entra ID) support role definitions for users. However, if you prefer to use the identity provider solely for authentication while managing user roles through other means (like a database), you can customize this behavior by implementing the `roles` property of the `User` model in `app/models/user.py`.

```python
# Fake database to demonstrate the concept
db = {"1000": ["admin"], "1001": ["user"]}

class User(BaseUser):
    @property
    def roles(self) -> list[str]:
        return db[self.id]
```
