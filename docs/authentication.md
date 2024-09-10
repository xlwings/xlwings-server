# Authentication

The most comfortable authentication method is to use the built-in single sign-on (SSO) via Microsoft Entra ID (previously called Azure AD).

## SSO via Microsoft Entra ID

Single sing-on (SSO) is only available for Office.js add-ins.

### Enable SSO

1. [Register your add-in as an app on the Microsoft Identity Platform](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2)

2. Change the following settings:

```ini
XLWINGS_AUTH_PROVIDERS=["entraid"]
XLWINGS_AUTH_ENTRAID_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
XLWINGS_AUTH_ENTRAID_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

3. Go to the `/manifest` endpoint and sideload the updated version of the manifest (restart Excel).

### Airgapped servers

Airgapped servers won't be able to acquire the latest version of the Entra ID certs. There, you need to set up a procedure that gets the certs and stores it somewhere where they are accessible for your server.

TODO

## User Model

TODO

### Authorization

TODO

### Current User Object

TODO
