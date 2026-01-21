# Azure Functions

## Prerequisites

1. Run the following command on a Terminal to create the required files:

   ```
   uv run xlwings-server add azure functions
   ```

   This will add the required files (`function_app.py`, `host.json`, `.funcignore`, `local.settings.json`)

2. Install the following software:

   - [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
   - [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)

3. Before you begin, you'll need to login to Azure:

   ```text
   az login
   ```

```{note}
If you deploy to Azure Functions using a different method, you should be able to adapt the instructions accordingly.
```

## Files

The following files are part of Azure functions setup and can be edited according to your needs:

- `host.json`
- `local.settings.json`
- `function_app.py`
- `.funcignore`

```{important}
Azure functions require a traditional `requirements.txt` file in the root of your project. If you use `uv`, run the following command before deploying (ideally, this is done automatically as part of your build step): `uv export --format requirements.txt -o requirements.txt`.
```

## Deployment

First, set the following environment variables to match your preferences:

```{important}
You need to replace `xlwings-server` with your own app name as the name needs to be globally unique.
```

```bash
export FUNCTION_APP_NAME=xlwings-server
export RESOURCE_GROUP=xlwings-server-rg
export STORAGE_ACCOUNT=xlwingsserversa
export LOCATION=westeurope
export XLWINGS_LICENSE_KEY=your-license-key
export XLWINGS_ENVIRONMENT=prod
```

You may also want to skip some of the steps, e.g., if you already have an existing resource group or storage account to deploy to.

1.  Create a resource group:

    ```bash
    az group create --name $RESOURCE_GROUP --location $LOCATION
    ```

2.  Create storage account:

    ```bash
    az storage account create --name $STORAGE_ACCOUNT --location $LOCATION --resource-group $RESOURCE_GROUP --sku Standard_LRS
    ```

3.  Create the function app:

    ```bash
    az functionapp create --resource-group $RESOURCE_GROUP --consumption-plan-location $LOCATION --runtime python --runtime-version 3.11 --functions-version 4 --name $FUNCTION_APP_NAME --os-type linux --storage-account $STORAGE_ACCOUNT
    ```

4.  Set the required environment variables. Make sure to provide your own license key at the end of this command (you can get a free trial key [here](https://www.xlwings.org/trial)). You'll also need to adjust the `XLWINGS_ENVIRONMENT` if this is not the `prod` environment:

    ```bash
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings XLWINGS_ENVIRONMENT=$XLWINGS_ENVIRONMENT XLWINGS_ENABLE_SOCKETIO=false XLWINGS_LICENSE_KEY=$XLWINGS_LICENSE_KEY
    ```

5.  Run the following to enable the worker process to index the functions:

    ```bash
    az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings AzureWebJobsFeatureFlags=EnableWorkerIndexing
    ```

6.  Deploy the function app (this is also the command to deploy an update):

    ```{important}
    This command must be run from the root of your project.
    ```

    ```bash
    func azure functionapp publish $FUNCTION_APP_NAME
    ```

    It should terminate with the following message:

    ```text
    Remote build succeeded!
    [...] Syncing triggers...
    Functions in xlwings-server:
       http_app_func - [httpTrigger]
          Invoke url: https://xlwings-server.azurewebsites.net//{*route}
    ```

    If you don't have access to the `func` CLI, e.g., in the Azure cloud shell, use the following commands instead:

    ```{important}
    This command must be run from the root of your project.
    ```

    ```bash
    zip -r function.zip .

    az functionapp deployment source config-zip \
    --resource-group $RESOURCE_GROUP \
    --name $FUNCTION_APP_NAME \
    --src function.zip \
    --build-remote true
    ```

If there's nothing printed after `Functions in ...`, have a look at [](#logging) to find out the reason, otherwise go to the URL without the `//{*route}` part (in the example, that would be `https://xlwings-server.azurewebsites.net`) and you should see `{"status": "ok"}`.

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

You can use the following template:

https://github.com/Azure/actions-workflow-samples/blob/master/FunctionApp/linux-python-functionapp-on-azure.yml

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
    zip -r function.zip .
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
