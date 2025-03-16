# Authorization and RBAC

_Authentication_ answers the question, "Who is the user?" while _authorization_ determines, "Does the authenticated user have the required rights?".

By adding an authentication provider via `XLWINGS_AUTH_PROVIDERS`, only logged in users will be able to call [](custom_functions.md) and [](custom_scripts.md).

If you want to further differentiate between users, you need to implement authorization, either on a global level or for specific custom functions or custom scripts. You can do this by using _role-based access-control_ (RBAC), which allows you to restrict access to only users who possess the required roles.

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

## Custom user model

To customize how xlwings Server performs authorization, you can modify the `User` class in `app/models/user.py`. The `User` class inherits from `BaseUser`, which offers the following attributes by default:

```text
id
name
domain
email
roles
claims
ip_address
```

For example, if you use Entra ID, all claims are added in the form of a dictionary to the `claims` attribute. So if you want to turn a specific claim into a direct user attribute, you could write:

```python
class User(BaseUser):
    @property
    def mycompany_id(self) -> str:
        return self.claims.get("mycompany_id")
```

Another example is the handling of roles: many identity providers (such as Entra ID) support role definitions for users. However, if you prefer to use the identity provider solely for authentication while managing user roles through other means (like a database), you can customize this behavior by implementing the `roles` property.

```python
# Fake database to demonstrate the concept
db = {"1000": ["admin"], "1001": ["user"]}

class User(BaseUser):
    @property
    def roles(self) -> list[str]:
        return db[self.id]
```

If your needs are completely different from the `BaseUser` and you want to implement the `User` class from scratch, inherit from `BaseModel` instead of `BaseUser`:

```python
from pydantic import BaseModel

class User(BaseModel):
    id: str
    name: str
```

This will define the user model as a [Pydantic](https://docs.pydantic.dev) model. Alternatively, you could also implement it as a `dataclass` or an SQLAlchemy model, etc.
