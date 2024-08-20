# xlwings Server

## Features

- Only requires Python 3.9+ (no dependency on Node.js or Webpack)
- Uses FastAPI as the web framework
- Comes with htmx (client-server interaction), Alpine.js (CSP build, for client interactions), and Socket.io (for streaming functions and realtime updates of the task pane)
- Comes with Bootstrap-xlwings, a Bootstrap theme in the Excel look
- Runs in an air-gapped environment without access to the Internet or any Microsoft servers
- Supports SSO (Single Sign-On) authentication and RBAC (Role-Based Access Control) via Entra ID (previously known as Azure AD) simply by adding the Client and Tenant IDs to the `.env` file
- The task pane is hot-reloaded with every code change during development
- Tight security: uses the HTTP response headers recommended by OWASP including the most restrictive CSP header
- Supports streaming functions
- Supports object handles
- Cache busting for static files is automatically done when using the Docker image
- The manifest is a template that uses the correct URLs and IDs to prevent name clashing with different environments: it is shown under `/manifest`
- Development can be done on GitHub Codespaces, saving you from installing Python or mkcert locally
- Test coverage (growing...)
- xlwings Server is free for non-commercial use.

## Dev environment

- Follow the steps under https://docs.xlwings.org/en/latest/pro/server/officejs_addins.html#quickstart (but using this repo instead of the one mentioned in the quickstart). Mainly, you need to install `mkcert` to create local certificates as Office.js requires the web app to be served via https (not http) even on localhost.
- Alternatively, you can run this repo on GitHub Codespaces (make sure to expose the port 8000 publicly)
- Run `python run.py init`: this copies `.env.template` over to `.env` (`.env` isn't tracked in Git) and replaces the default manifest UUIDs under `app/config.py` with your own ones. Make sure to commit `app/config.py` once it has your own UUIDs.
- Advanced configuration is done via `.env` file, where the settings are explained (note that lines starting with `#` are comments)

**Backend via Python directly:**

- Install the dependencies: `pip install -r requirements-dev.txt`
- Run the app: `python run.py`

**Backend via Docker**:

- Install Docker and Docker Compose
- To run the dev server: `docker compose up`
- Run `docker compose build` whenever you need to install a new dependency via `requirements.txt`

**Office.js add-in**:

- Has to be sideloaded, see: https://learn.microsoft.com/en-us/office/dev/add-ins/testing/test-debug-office-add-ins#sideload-an-office-add-in-for-testing
- You'll find the addin by going to the `/manifest` endpoint, e.g., on localhost, go to https://127.0.0.1:8000/manifest. Store the text in a file called `manifest.xml` that you can use to sideload the add-in.

## Custom scripts & custom functions

- Custom functions can be added under `app/custom_functions/examples.py`. To add your own Python modules, see the instructions at the top of `examples.py`. There is a sample custom function included that can be run via `=XLWINGS.HELLO("xlwings")`. There's also a streaming function (`=XLWINGS.STREAMING_RANDOM(2, 3)`). The `XLWINGS` prefix ("namespace") can be adjusted via the settings (`XLWINGS_FUNCTIONS_NAMESPACE` in `.env` file). Except for the prod environment, `-dev` and `-uat` are automatically appended to avoid name clashes. So if you run this under a dev environment, you'll find the custom functions under the `XLWINGS_DEV` prefix.

- Scripts can be added under `app/custom_scripts/examples.py`. To add your own Python modules, see the instructions at the top of `examples.py`. They will need to be bound to a button on either the ribbon (via `app/templates/manifest.xml`) or task pane (e.g., see `app/templates/examples/hello_world/taskpane_hello.html`). There is a sample button `Hello World` included on both the ribbon and task pane. On the task pane, connecting a button is as easy as adding the `xw-click` attribute with the name of the Python function. Optionally, you can add configuration via `xw-config`, however the `auth` config is handled automatically:

  ```html
  <button
    xw-click="hello_world"
    xw-config='{"include": "Sheet1"}'
    class="btn btn-primary btn-sm"
    type="button"
  >
    Hello World
  </button>
  ```

  If you want to call scripts from VBA, Office Scripts, or Google Apps Script, you will need to use the runPython function with the following endpoint:

  ```vb
  runPython("https://127.0.0.1:8000/xlwings/custom-scripts-call/hello_world")
  ```

## Examples

A good way to get started is to look at the examples:

- Custom functions: `app/custom_functions/examples.py`
- Custom scripts via button on task pane: `app/custom_scripts/examples.py`
- Custom script via button on ribbon: `app/static/js/ribbon.js`
- Task pane examples: `app/templates/examples`

## Manage dependencies (requirements.txt)

Add your own dependencies to `requirements.in` (note `.in`, not `.txt`). If you have a development dependency, add it to `requirements-dev.in` instead. If you need to pin a dependency to a certain version, you also do that in the `.in` version of your requirements file.

After changing any dependencies via `.in` file, you need to run `python run.py deps compile`. This uses [uv](https://github.com/astral-sh/uv) under the hood to produce a series of `requirements.txt` files where the dependencies incl. sub-dependencies will be pinned.

Here's an example of `requirements.in`:

```
-r requirements-core.txt  # Don't delete this line
pandas
numpy==1.26.4
```

**Installing deploy keys automatically in Docker images**

If you have your developer license key set as `XLWINGS_DEVELOPER_KEY` env var in your build environment, it will install the deploy key directly in the Docker image when running `docker build --build-arg XLWINGS_DEVELOPER_KEY=${XLWINGS_DEVELOPER_KEY} .`.

## Authentication & Authorization with Entra ID (previously called Azure AD)

1. Register your Excel add-in as app on Microsoft Entra ID by following these instructions: https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2

2. Set your environment variables, e.g., in `.env` like this:

   ```
   XLWINGS_AUTH_PROVIDERS=["entraid"]
   XLWINGS_AUTH_ENTRAID_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   XLWINGS_AUTH_ENTRAID_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

3. Calling custom functions and custom scripts use the `dependencies.User` dependency injection to authenticate the user (see application logs).

4. To only allow users with specific roles to use your application, you can use the `XLWINGS_AUTH_REQUIRED_ROLES` setting.

5. To set up the roles in Entra ID and map them to users, follow these instructions:

   Go to All Services > Microsoft Entra ID > App registrations > Your app > App roles (left sidebar):

   - Click on Create app role
   - Display name (e.g.): Writer
   - Allowed member types: Users/Groups
   - Value (e.g.): Task.Write
   - Description (e.g.): Writer
   - Checkbox must be active for `Do you want to enable this app role`?
   - Apply => Repeat for other roles

   Go all the way back to All Services > Microsoft Entra ID, then under Enterprise applications (left sidebar):

   - Select your app
   - Click on the `Assign users and groups` link in the "1. Assign users and groups" box
   - Click on `+ Add user/group`
     - Under User, click on `None Selected` and select a user or group. Confirm with `Select`.
     - Under Role, click on `None Selected` and select the desired role (if you don't see any role, wait a moment and reload the page). Confirm with `Select`.
     - Repeat the last step to give the user more roles

## Docker Hub

A production docker image is published to https://hub.docker.com/r/xlwings/xlwings-server:

```
docker pull xlwings/xlwings-server:latest
```

It could be used for quickly spinning up an environment and to test-drive the contained examples.

## Production Deployment

### Manifest

The `manifest.xml` has to be deployed via the Office admin console, see: https://docs.xlwings.org/en/latest/pro/server/officejs_addins.html#production-deployment. The Office admin console also allows you to point directly to the `/manifest` endpoint.

### Deployment to Azure Functions

NOTE: Azure functions doesn't support WebSockets, i.e. streaming functions and `trigger_script` won't work

For the following walk through, you'll need to have the Azure CLI and Azure Functions Core Tools installed, see [here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).

#### Create a function app

While you can run Azure functions locally, we're deploying the function app directly to Azure:

In the commands below, we're going to use the following names/parameters:

- the function app: `xlwings-quickstart`
- the resource group: `xlwings-quickstart-rg`
- the storage account: `xlwingsquickstartsa`
- deploy it to the region: `westeurope`

Note that you may need to use different names/parameters though.

Before you begin, you'll need to login to Azure:

```bash
az login
```

1.  Create a resource group:

    ```bash
    az group create --name xlwings-quickstart-rg --location westeurope
    ```

2.  Create storage account:

    ```bash
    az storage account create --name xlwingsquickstartsa --location westeurope --resource-group xlwings-quickstart-rg --sku Standard_LRS
    ```

3.  Create the function app (if possible, use the same Python version locally as the one specified in this command):

    ```bash
    az functionapp create --resource-group xlwings-quickstart-rg --consumption-plan-location westeurope --runtime python --runtime-version 3.11 --functions-version 4 --name xlwings-quickstart --os-type linux --storage-account xlwingsquickstartsa
    ```

4.  Set the required environment variables (you can get a free trial key [here](https://www.xlwings.org/trial)). Note that streaming functions
    and other Socket.io-related functionality is not supported with Azure Functions:

    ```bash
    az functionapp config appsettings set --name xlwings-quickstart --resource-group xlwings-quickstart-rg --settings XLWINGS_ENVIRONMENT=prod XLWINGS_ENABLE_SOCKETIO=false XLWINGS_LICENSE_KEY=<YOUR_LICENSE_KEY>
    ```

5.  Run the following to enable the worker process to index the functions:

    ```bash
    az functionapp config appsettings set --name xlwings-quickstart --resource-group xlwings-quickstart-rg --settings AzureWebJobsFeatureFlags=EnableWorkerIndexing
    ```

6.  Deploy the function app (this is also the command to deploy an update):

    ```bash
    func azure functionapp publish xlwings-quickstart
    ```

    It should terminate with the following message:

    ```bash
    Remote build succeeded!
    [...] Syncing triggers...
    Functions in xlwings-quickstart:
       http_app_func - [httpTrigger]
          Invoke url: https://xlwings-quickstart.azurewebsites.net//{*route}
    ```

#### Cleanup

After running this tutorial you can get rid of all the resources again by running:

```bash
az group delete --name xlwings-quickstart-rg
```

### Deployment to AWS App Runner

NOTE: AWS AppRunner doesn't support WebSockets, i.e. streaming functions and `trigger_script` won't work

- In this repo, update `apprunner.yaml` with your `XLWINGS_LICENSE_KEY` either as `env` or `secret`
- Under App Runner, click on `Create service`
- Repository type: Source code repository
- Source directory: `/`
- Deployment trigger: Automatic
- Configuration file: Use a configuration file
- Service name: e.g. `xlwings-server`
- Click on `Create & deploy`

### Deployment via Docker Compose

- Set the following environment variables either on your VM or in the `.env` file:

  - `XLWINGS_LICENSE_KEY`
  - `XLWINGS_ENVIRONMENT="prod"`

- Store your TLS certificates in the `certs` folder with the following names:

  - `privkey.pem`
  - `fullchain.pem`

- Whenever there are changes to your source code, in the root directory, run:

  ```
  docker compose -f docker/docker-compose.prod.yaml build
  ```

- To run the app:

  ```
  docker compose -f docker/docker-compose.prod.yaml up -d
  ```

- To check the logs:

  ```
  docker compose -f docker/docker-compose.prod.yaml logs -f
  ```

If you prefer a much more minimal setup, you can also run the following instead:

```
docker compose -f docker/docker-compose.prod-min.yaml up -d
```

NOTE:

- The minimal setup doesn't support streaming functions
- The minimal setup requires an external Redis service for object handles via `XLWINGS_OBJECT_CACHE_URL`
