# Authentication

This tutorial covers both authentication ("who is the user?") and authorization ("does the authenticated user have the required rights?").

The most comfortable authentication method is the built-in single sign-on (SSO) via Microsoft Entra ID (previously called Azure AD). You can, however, add your own custom authentication and authorization methods.

```{note}
The authentication described in this document protects the execution of custom scripts and custom functions, but it currently doesn't affect the Office.js task pane.
```

## Authorization

At the core of the authentication system is the `User` model. You can find it under [`app/models/user.py`](https://github.com/xlwings/xlwings-server/blob/main/app/models/user.py).

To add global authorization, you can implement the `User.is_authorized()` method. For example, to only allow users with the domain `mydomain.com` to run custom scripts and custom functions, you could do:

```python
async def is_authorized(self):
    return self.domain == "mydomain.com" if self.domain else False
```

Likewise, to only authorize users with certain roles, you could write:

```python
async def is_authorized(self):
    return await self.has_required_roles(["xlwings.user", "db.writer"])
```

## Current user object

If you need access to the current user object from a custom script or a custom function, you can use a function parameter with the type hint `CurrentUser`:

```python
from ..models import CurrentUser

@func
def get_current_user(current_user: CurrentUser):
    return f"The user's domain is {current_user.domain}"
```

## Anonymous user

By default, there is no authentication provider configured (`XLWINGS_AUTH_PROVIDERS=[]`) and everyone will be able to run custom functions and custom scripts. The current user object will be `User(id='n/a', name='Anonymous', email=None, domain=None, roles=[])`.

## SSO via Microsoft Entra ID

```{note}
Single sign-on (SSO) is only available for Office.js add-ins.
```

### Enable SSO

1. [Register your add-in as an app on the Microsoft Identity Platform](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2)

2. Provide the following settings, using your actual ClientID and TenantID that you can find on the Entra ID dashboard:

```ini
XLWINGS_AUTH_PROVIDERS=["entraid"]
XLWINGS_AUTH_ENTRAID_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
XLWINGS_AUTH_ENTRAID_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

To permit users from external organizations, you additionally need to set the following setting to true:

```ini
XLWINGS_AUTH_ENTRAID_MULTITENANT=true
```

3. Go to the `/manifest` endpoint and sideload the updated version of the manifest (restart Excel).
4. Optionally implement an `User.is_authorized()` method, see [](#authorization).

### Entra ID Roles

Optionally, you can work with roles. On the [Azure Dashboard](https://portal.azure.com/), go to `Microsoft Entra ID`. On the left side bar under `Manage`, click on `App registrations`. Click on the correct app, then:

- `App roles` (left sidebar, under `Manage`):

  - Click on `Create app role`
  - `Display name`: e.g. `Writer`
  - `Allowed member types`: `Users/Groups`
  - `Value`: e.g. `Task.Write`
  - `Description`: `Writer`
  - Checkbox must be active for `Do you want to enable this app role?`
  - `Apply`

=> Repeat this step to create other roles.

- Go all the way back to `Microsoft Entra ID`, then under `Enterprise applications` (left sidebar under `Manage`):
  - Select the previously created application `xlwings`
  - Click on `1. Assign users and groups`
  - Click on `Add user/group`
    - Under `User`, click on `None Selected` and select a user or group. Confirm with `Select`.
    - Under `Role`, click on `None Selected` and select `Writer` or `Reader` (if you don't see any role, wait a moment and reload the page). Confirm with `Select`.
    - Repeat the last step to give the user both `Reader` and `Writer` roles

These roles will be available under `User.roles` and can be used in order to implement role-based access control (RBAC), see [](#authorization).

### Air-gapped servers

In order to verify the JWT token that Office.js sends to the backend, the backend needs access to the latest version of the Azure JSON Web Key Set (JWKS).

If your application runs on an air-gapped server and can't download the JWKS directly from the Internet, you can provide your own function under [`app/auth/entraid/jwks.py`](https://github.com/xlwings/xlwings-server/blob/main/app/auth/entraid/jwks.py) to access the JSON file. For example, you could have a cron job that downloads the JSON document once every 24 hours and stores it in a location where the air-gapped server has access.

The URL to retrieve the JWKS JSON file is: https://login.microsoftonline.com/common/discovery/v2.0/keys

## Custom authentication

To use your own authentication method, activate the `custom` authentication provider:

```ini
XLWINGS_AUTH_PROVIDERS=["custom"]
```

To make this work, you need to implement

- `validate_token` under [`app/auth/custom/__init__.py`](https://github.com/xlwings/xlwings-server/blob/main/app/auth/custom/__init__.py)
- `globalThis.getAuth` under [`app/static/auth.js`](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/auth.js)

Essentially, you will need to adjust `globalThis.getAuth` so that it returns the token that you will validate with the `validate_token` function on the backend.
