# Authentication

To authenticate (and possibly authorize) the users of your custom functions, you'll need to implement a global `getAuth()` function under `app/taskpane.html`. In the quickstart project, it's set up to give back an empty string:

.. code-block: js

    globalThis.getAuth = async function () {
      return ""
    };

The string that this function returns will be provided as Authorization header whenever a custom function executes so the backend can authenticate the user. Hence, to activate authentication, you'll need to change this function to give back the desired token/credentials.

.. note:

    The `getAuth` function is required for custom functions to work, even if you don't want to authenticate users, so don't delete it.

**SSO / Entra ID (previously called AzureAD) authentication**

The most convenient way to authenticate users is to use single-sign on (SSO) based on Entra ID (previously called Azure AD), which will use the identity of the signed-in Office user:

.. code-block: js

    globalThis.getAuth = async function () {
      return await xlwings.getAccessToken();
    };

- This requires you to set up an Entra ID (previously called Azure AD) app as well as adjusting the manifest accordingly, see :ref:`pro/server/server_authentication:SSO/Entra ID (previously called Azure AD) for Office.js`.
- You'll also need to verify the AzureAD access token on the backend. This is already implemented in https://github.com/xlwings/xlwings-server
