# Quick Start

## 1. Get a License Key

Get a [trial license key](https://www.xlwings.org/trial) as you will need it in the next step.

## 2. Install xlwings-server

1. Install [uv](https://docs.astral.sh/uv/), Python's modern package manager. Run the following commands on a Terminal:

   ::::{tab-set}

   :::{tab-item} Windows

   ```bash
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```

   :::
   :::{tab-item} macOS and Linux

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

   :::

   ::::

2. Create a new uv project (I'll be calling it `myproject` here) and change into the directory:

   ```text
   uv init myproject
   cd myproject
   ```

3. Install `xlwings-server` and `watchfiles` (for hot-reloading), then initialize xlwings-server:

   ```bash
   uv add xlwings-server
   uv add watchfiles --dev
   uv run xlwings-server init .
   ```

4. Add the license key to the `.env` file:

   ```ini
   XLWINGS_LICENSE_KEY="your-license-key"
   ```

5. Create local TLS certificates:

   Excel requires the server to run on HTTPS (not HTTP), even for local development. [Download mkcert](https://github.com/FiloSottile/mkcert/releases) (pick the correct file according to your platform), rename the file to `mkcert`, then run the following commands from a Terminal/Command Prompt (make sure you're in the same directory as `mkcert`):

   ```text
   ./mkcert -install
   ./mkcert localhost 127.0.0.1 ::1
   ```

   This will generate two files `localhost+2.pem` and `localhost+2-key.pem`. Move them to the `certs` directory of your project.

6. Run the server

   ```bash
   uv run xlwings-server
   ```

   You should see output along the following lines:

   ```text
   INFO:     Will watch for changes in these directories: ['/Users/felix/dev/myproject']
   INFO:     Uvicorn running on https://127.0.0.1:8000 (Press CTRL+C to quit)
   INFO:     Started reloader process [77403] using WatchFiles
   INFO:xlwings_server.main:Running in 'Server' mode.
   INFO:     Started server process [77411]
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   ```

## 3. Install the Excel add-in

With the server running, go to https://127.0.0.1:8000/manifest/download in a browser. This downloads the Office.js manifest as `<project-name>-dev.xml`. The manifest is an XML file that you load into Excel and that points Excel to your backend server. During development, _sideload_ the manifest according to your platform:

- [Excel on Windows](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/create-a-network-shared-folder-catalog-for-task-pane-and-content-add-ins)
- [Excel on macOS](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)
- [Excel on the web](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing#manually-sideload-an-add-in-to-office-on-the-web)

In Excel, go to `Add-ins` on the ribbon's `Home` tab:

- **Windows**: click on `More Add-ins` > `Shared Folder`. Select the add-in, then click on `Add`.
- **macOS**: you will see your add-in listed under `Developer add-ins`. Note that you will have to activate the add-in every time you restart Excel.

## 4. Take it for a Spin!

Now you are ready to play around with the provided examples:

- Scripts: `custom_scripts/scripts.py` -> click the button in the task pane (see `templates/taskpane.html`). See [](custom_scripts.md) for more information.
- Custom Functions: `custom_functions/functions.py` -> write the following formula into Excel `=XLWINGS_DEV.HELLO("xlwings")`. See [](custom_functions.md) for more information.
