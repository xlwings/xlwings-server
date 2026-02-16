# Microsoft Entra ID (SSO)

Single sign-on (SSO) means that the user's identity within Office (either a Microsoft account or a Microsoft 365 identity) is used. Enabling SSO requires to:

- Set up an Entra ID app on the Azure portal
- Configure xlwings Server

```{note}
SSO is only available for Office.js add-ins.
```

## Enable SSO

1. [Register your add-in as an app on the Microsoft Identity Platform {octicon}`link-external`](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2)

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

3. Go to the `/manifest` endpoint, update your `manifest.xml` with its content, and sideload the updated version of the manifest (restart Excel).
4. Optionally implement a global `User.is_authorized()` method, see [](authorization.md).

## Entra ID Roles

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

## Microsoft Graph API via On-Behalf-Of (OBO) Flow

You can access the Microsoft Graph API on behalf of the authenticated user using the On-Behalf-Of (OBO) flow. This allows your custom scripts and custom functions to interact with SharePoint, OneDrive, Outlook, and other Microsoft 365 services.

### Setup

1. On the [Azure Dashboard](https://portal.azure.com/), go to `Microsoft Entra ID` > `App registrations` and select your app.

2. Under `Certificates & secrets` (left sidebar), create a new client secret and add it to your `.env` file or environment variables, respectively:

   ```ini
   XLWINGS_AUTH_ENTRAID_CLIENT_SECRET="your-client-secret"
   ```

3. Under `API permissions` (left sidebar), click `Add a permission` > `Microsoft Graph` > `Delegated permissions`, then add the permissions your application needs (e.g., `User.Read`, `Sites.Read.All`, `Files.Read.All`) and confirm via `Add permissions`.

4. Click `Grant admin consent` (next to `+ Add permission`) to consent to the permissions on behalf of all users in your organization. This is required because the OBO flow cannot prompt users for interactive consent.

### Usage

Use `current_user.get_graph_client()` in your custom scripts or custom functions to get a Graph API client:

```python
import xlwings as xw
from xlwings import script
from xlwings_server.models import CurrentUser


@script
async def get_user_profile(book: xw.Book, current_user: CurrentUser):
    async with current_user.get_graph_client() as graph:
        # Get user profile
        response = await graph.get("/me")
        me = response.json()
        sheet = book.sheets.active
        sheet["A1"].value = me["displayName"]
        sheet["A2"].value = me["mail"]
```

The `GraphClient` provides `get()`, `post()`, `patch()`, and `delete()` methods. The path is relative to `https://graph.microsoft.com/v1.0`. All keyword arguments are passed through to [httpx](https://www.python-httpx.org/), so you can use `params`, `json`, `headers`, `timeout`, etc. All methods return an `httpx.Response` object. A few examples:

```python
# List files in OneDrive (Files.Read)
response = await graph.get("/me/drive/recent")
files = response.json()

# Query parameters (Mail.Read)
response = await graph.get("/me/messages", params={"$top": 10})
messages = response.json()

# POST with JSON body (Mail.Send)
await graph.post("/me/sendMail", json={"message": {...}})

# Binary content, e.g., file download (Files.Read)
response = await graph.get("/me/drive/items/{id}/content")
file_bytes = response.content
```

```{note}
The OBO token is kept server-side and is never sent back to the Excel client. Only the results of the Graph API calls are returned.
```

## JWKS with air-gapped servers

In order to verify the JWT token that Office.js sends to the backend, the backend needs access to the latest version of the Azure JSON Web Key Set (JWKS).

If your application runs on an air-gapped server and can't download the JWKS directly from the internet, you can provide your own function to access the JSON file. For example, you could have a cron job that downloads the JSON document once every 24 hours and stores it in a location where the air-gapped server has access. The URL to retrieve the JWKS JSON file is: https://login.microsoftonline.com/common/discovery/v2.0/keys

To implement your own function, run the following command on a Terminal:

```
uv run xlwings-server add auth entraid
```

This will create the following file `auth/entraid/jwks.py` where you can implement the `get_jwks_json` function to read the externally downloaded JSON file.
