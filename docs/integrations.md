# Integrations

This page gives you an overview over the different integrations that you can use to talk from Excel or Google Sheets to xlwings Server. Note that various integrations can talk to the same server.

## Office.js add-in (recommended)

This is the recommended approach as it fits enterprise requirements the best.

**Pros**:

- Works on Windows, macOS, and Excel on the Web
- No VBA or JavaScript required
- Supports custom functions incl. streaming functions and object handles. All custom functions are async natively.
- Central deployment of the Excel add-in via the Microsoft 365 admin center (company internal) or via Excel's add-in store (public add-ins). There's no need to have end-users install the add-in manually.
- Single sign-on (SSO) authentication and role-based access control (RBAC) via [Microsoft Entra ID](https://www.microsoft.com/en-us/security/business/identity-access/microsoft-entra-id) (formerly Azure AD)
- Allows to build web-based task panes with virtually unlimited possibilities.

**Cons**:

- Setting up a local development environment for the first time is slightly harder as you need development certificates to run the server on https instead of http. You could, however, use a cloud-based IDE such as GitHub Codespaces, which doesn't require this step.
- Production deployment requires the help of an admin of the Microsoft 365 admin center

## VBA

Using VBA can make sense if VBA is the technology you're feeling most comfortable with and if none of the cons affect you.

**Pros**:

- You can create standalone macro-enabled workbooks that won't require any add-in to be installed.
- Alternatively, you can also rely on the xlwings add-in to be installed or build a custom VBA add-in.
- Works and feels like a classic macro-enabled workbook.

**Cons**:

- No support for custom functions.
- No support for authentication.
- No support for Excel on the web.
- VBA faces increasing headwinds as some companies disable VBA completely or restrictive virus scanners block it's execution (false positive). Microsoft has also introduced extra steps to make VBA-enabled workbooks run when they originate from the internet or a network location.

## Office Scripts

If you have access to Office Scripts and aren't affected by the cons, this is a good option.

**Pros**:

- Allows to place buttons on workbooks to run Python code.
- Runs on Windows, macOS, and Excel on the web.
- Easy deployment: a single xlwings Office Script file can be used by multiple workbooks and users.

**Cons**:

- No support for custom functions.
- No support for authentication.
- Requires Microsoft 365 with OneDrive/SharePoint, does not work with the permanent versions of Office like Office 2024.
- Cannot be used in PowerAutomate flows as running Office Scripts via PowerAutomate doesn't support calls to the external servers.
- Does not work without an Internet connection.
- Does not comply with privacy standards: transmits content to Microsoft.
- Developing requires a [tunneling solution](tunneling.md) like ngrok.

## Google Apps Script

Google Sheets is a solid web-based spreadsheet with the option to run your Python scripts via built-in scheduler.

**Pros**:

- Best performing solution for online spreadsheets
- Single sign-on (SSO) authentication via Google account
- Supports buttons on sheets
- Supports custom menu items
- Allows you to run your Python scripts via built-in scheduler (think cronjobs)
- Only requires pasting the Google Apps Scripts xlwings module

**Cons**:

- It's not Excel.
- No support for custom functions (planned).
- Does not work without an Internet connection.
- Does not comply with privacy standards: content is hosted by Google.
- Developing requires a [tunneling solution](tunneling.md) like ngrok.
