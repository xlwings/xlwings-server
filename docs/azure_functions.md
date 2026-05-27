# Azure Functions

## Prerequisites

1. Install the following software:

   - [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
   - [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)

1. Run the following command on a Terminal to create the required files:

   ```
   uv run xlwings-server add azure functions
   ```

   This will add the following files that you can customize:

   ```
   host.json
   local.settings.json
   function_app.py
   .funcignore
   ```

1. Generate `requirements.txt`:

   Azure functions require a traditional `requirements.txt` file in the root of your project. If you use uv, run the following command before deploying (ideally, this is done automatically as part of your CI, see e.g., the Azure DevOps Pipeline below):

   ```txt
   uv export --format requirements.txt -o requirements.txt
   ```

1. Before you begin, you'll need to login to Azure:

   ```text
   az login
   ```

## Deployment

First, set the following environment variables (`my-app-name` and `your-license-key` are required to be changed):

```bash
export FUNCTION_APP_NAME=my-app-name
export RESOURCE_GROUP=xlwings-server-rg
export STORAGE_ACCOUNT=xlwingsserversa
export LOCATION=westeurope
export XLWINGS_LICENSE_KEY=your-license-key
export XLWINGS_ENVIRONMENT=prod
```

You may want to skip some of the following steps, e.g., if you already have an existing resource group or storage account to deploy to.

1.  Create a resource group:

    ```text
    az group create --name $RESOURCE_GROUP --location $LOCATION
    ```

2.  Create storage account:

    ```text
    az storage account create \
      --name $STORAGE_ACCOUNT \
      --location $LOCATION \
      --resource-group $RESOURCE_GROUP \
      --sku Standard_LRS
    ```

3.  Create the function app:

    ```text
    az functionapp create \
      --resource-group $RESOURCE_GROUP \
      --name $FUNCTION_APP_NAME \
      --storage-account $STORAGE_ACCOUNT \
      --flexconsumption-location $LOCATION \
      --runtime python \
      --runtime-version 3.12
    ```

4.  Set the required environment variables. Make sure to provide your own license key at the end of this command (you can get a free trial key [here](https://www.xlwings.org/trial)). You'll also need to adjust the `XLWINGS_ENVIRONMENT` if this is not the `prod` environment:

    ```text
    az functionapp config appsettings set \
      --name $FUNCTION_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --settings \
        XLWINGS_ENVIRONMENT=$XLWINGS_ENVIRONMENT \
        XLWINGS_ENABLE_SOCKETIO=false \
        XLWINGS_LICENSE_KEY=$XLWINGS_LICENSE_KEY
    ```

5.  Run the following to enable the worker process to index the functions:

    ```text
    az functionapp config appsettings set \
      --name $FUNCTION_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --settings AzureWebJobsFeatureFlags=EnableWorkerIndexing
    ```

6.  Deploy the function app (this is also the command to deploy an update):

    ```{important}
    This command must be run from the root of your project.
    ```

    ```text
    func azure functionapp publish $FUNCTION_APP_NAME
    ```

    If you don't have access to the `func` CLI, e.g., in the Azure cloud shell, use the following commands instead:

    ```text
    zip -r function.zip . \
      -x ".git/*" ".venv/*" "venv/*" "__pycache__/*" "*/__pycache__/*" \
         ".env" ".env.*" "*.pyc" ".pytest_cache/*" ".ruff_cache/*"

    az functionapp deployment source config-zip \
      --resource-group $RESOURCE_GROUP \
      --name $FUNCTION_APP_NAME \
      --src function.zip \
      --build-remote true
    ```

    It should terminate with the following message:

    ```text
    Remote build succeeded!
    [...] Syncing triggers...
    Functions in xlwings-server:
       http_app_func - [httpTrigger]
          Invoke url: https://<my-app-name>.azurewebsites.net//{*route}
    ```

    If there's nothing printed after `Functions in ...`, have a look at [](#logging) to find out the reason, otherwise go to the URL without the `//{*route}` part (in the example, that would be `https://<my-app-name>.azurewebsites.net`) and you should see `{"status": "ok"}`.

## Keeping your deployment up to date

Azure handles most platform patching for you, but a few things are your responsibility:

- **Stay on a supported Functions host runtime version.** Check the [supported versions overview](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions).
- **Track Python version end-of-life.** Bump `--runtime-version` before your version drops off the [language support matrix](https://learn.microsoft.com/en-us/azure/azure-functions/functions-versions). To bump the Python version on an existing app, go to **Settings > Configuration > Stack settings** and set the version in the dropdown or run the following command:

  ```text
  az functionapp config set \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --linux-fx-version "Python|3.12"
  ```

## Logging

- If your app correctly deploys including syncing triggers, you can look at the runtime logs in Azure portal like so:
  `Function App` > `My Function App`. Then, under `http_app_func`, click on `Invocations and more`.

- If your Azure functions doesn't manage to sync triggers, i.e., it doesn't print a URL after running `func azure functionapp publish`, you need to go to the Azure portal:
  `Function App` > `My Function App`. In the left-hand menu, select `Diagnose and solve problems` > `Availability and Performance` and finally click on `Functions that are not triggered` on the left-hand side.

- For a live tail of your functions, go to `Monitoring` > `Log stream` and wait until it says `Connected!`. Now run an xlwings function or script and you should see the logging turning up. Note that this is only for live tailing, you won't see log messages from the past here. You may want to try out both `App Insights Logs` and `Filesystem Logs`.

## Cleanup

After running this tutorial you can get rid of all the resources again by running:

```text
az group delete --name xlwings-server-rg
```

## GitHub Actions

Here's a sample workflow file (adapted from [Azure/actions-workflow-samples](https://github.com/Azure/actions-workflow-samples/blob/master/FunctionApp/linux-python-functionapp-on-azure.yml)):

```yaml
name: Deploy Python project to Azure Function App

on: [push]

# CONFIGURATION
# For help, go to https://github.com/Azure/Actions
#
# 1. Set up the following secrets in your repository:
#   AZURE_FUNCTIONAPP_PUBLISH_PROFILE
#
# 2. Change these variables for your configuration:
env:
  AZURE_FUNCTIONAPP_NAME: 'your-app-name'   # set this to your function app name on Azure
  AZURE_FUNCTIONAPP_PACKAGE_PATH: '.'       # set this to the path to your function app project, defaults to the repository root
  PYTHON_VERSION: '3.12'                    # keep in sync with --runtime-version used when creating the function app

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment: dev
    steps:
    - name: 'Checkout GitHub Action'
      uses: actions/checkout@v6

    - name: Setup Python ${{ env.PYTHON_VERSION }} Environment
      uses: actions/setup-python@v6
      with:
        python-version: ${{ env.PYTHON_VERSION }}

    - name: 'Generate requirements.txt with uv'
      shell: bash
      run: |
        pip install uv
        uv export --format requirements.txt -o requirements.txt

    - name: 'Resolve Project Dependencies Using Pip'
      shell: bash
      run: |
        pushd './${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}'
        python -m pip install --upgrade pip
        pip install -r requirements.txt --target=".python_packages/lib/site-packages"
        popd

    - name: 'Run Azure Functions Action'
      uses: Azure/functions-action@v1
      id: fa
      with:
        app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
        package: ${{ env.AZURE_FUNCTIONAPP_PACKAGE_PATH }}
        publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
        scm-do-build-during-deployment: true
        enable-oryx-build: true
```

## Azure DevOps Pipelines

Here's a sample `azure-pipelines.yml` file:

```yaml
trigger:
- main

variables:
  # To set up the service connection:
  # 1. Go to your Azure DevOps project
  # 2. Navigate to Project Settings → Service connections
  # 3. Create a new Azure Resource Manager service connection
  # 4. Give it a name
  # 5. Use that name here under variables
  azureServiceConnection: 'TODO'
  functionAppName: 'TODO'
  resourceGroupName: 'TODO'

pool:
  vmImage: 'ubuntu-latest'

steps:
- bash: |
    pip install uv
    uv export --format requirements.txt -o requirements.txt
  displayName: 'Generate requirements.txt'

- bash: |
    zip -r function.zip . \
      -x ".git/*" ".venv/*" "venv/*" "__pycache__/*" "*/__pycache__/*" \
         ".env" ".env.*" "*.pyc" ".pytest_cache/*" ".ruff_cache/*"
  displayName: 'Create deployment package'

- task: AzureCLI@2
  displayName: 'Deploy to Azure Functions'
  inputs:
    azureSubscription: $(azureServiceConnection)
    scriptType: 'bash'
    scriptLocation: 'inlineScript'
    inlineScript: |
      # Deploy with remote build
      az functionapp deployment source config-zip \
        --resource-group $(resourceGroupName) \
        --name $(functionAppName) \
        --src function.zip \
        --build-remote true

```

## Limitations

- Azure functions don't support WebSockets directly, i.e., streaming functions won't work. However, you should be able to use the Azure service "Web PubSub for Socket.IO" instead.
- The function is always called `http_app_func`, see https://github.com/Azure-Samples/fastapi-on-azure-functions/issues/31
