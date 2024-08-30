# Clients

This page gives you an overview over the different clients that you can use to talk to xlwings Server. You can have various clients talk to the same server.

## Office.js add-in (recommended)

This is the recommended approach as it fits enterprise requirements the best.

**Pros**:

- SSO authentication and role-based access control (RBAC) via Microsoft Entra ID (formerly Azure AD)
- Works on Windows, macOS, Excel on the Web, and Excel on iPad
- No VBA required
- Supports custom functions incl. streaming functions and object handles. All custom functions are async natively.
- Central deployment of the Excel add-in via the Excel admin console (company internal) or via Excel's add-in store (public add-ins). There's no need to have end-users install the add-in manually.
- Allows to build web-based task panes with virtually unlimited possibilities.

**Cons**:

- Office.js doesn't support buttons on a worksheet to run Python code. You either have to use buttons on the ribbon or on the task pane. As a workaround, you could style a cell like a button and run the code when the cell is clicked.
- Setting up a local development environment for the first time is slightly harder as you need local TLS certificates to run the server on https instead of http.

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
- Cannot be used in PowerAutomate flows as running Office Scripts via PowerAutomate doesn't support calls the external servers.
- Does not work without an Internet connection.
- Does not comply with privacy standards: transmits content to Microsoft.

## Google Sheets

Google Sheets is a solid web-based spreadsheet with the option to run your Python scripts via built-in scheduler.

**Pros**:

- Best performing solution for online spreadsheets
- SSO authentication via Google account
- Supports buttons on sheets
- Supports custom menu items
- Allows you to run your Python scripts via built-in scheduler (think cronjobs)
- Only requires pasting the Google Apps Scripts xlwings module

**Cons**:

- No support for custom functions (planned).
- Does not work without an Internet connection.
- Does not comply with privacy standards: content is hosted by Google.
