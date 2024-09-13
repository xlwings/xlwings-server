# Azure Functions

## Prerequisites

For the following walk through, you'll need to have the following software installed:

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)

If you deploy to Azure Functions using a different method, you should be able to adapt the instructions accordingly.

Before you begin, you'll need to login to Azure:

```text
az login
```

## Files for Azure functions

The following files are part of Azure functions setup and may need to be tweaked:

- `host.json`
- `function_app.py`
- `local.settings.json`
- `.funcignore`

## Deployment to Azure functions

In the commands below, we're going to use the following parameters that you should adjust to match your preferences:

- The function app: `xlwings-server`
- The resource group: `xlwings-server-rg`
- The storage account: `xlwingsserversa`
- Region: `westeurope`

You may also want to skip some of the steps, e.g., if you already have an existing resource group or storage account to deploy to.

1.  Create a resource group:

    ```text
    az group create --name xlwings-server-rg --location westeurope
    ```

2.  Create storage account:

    ```text
    az storage account create --name xlwingsserversa --location westeurope --resource-group xlwings-server-rg --sku Standard_LRS
    ```

3.  Create the function app (if possible, use the same Python version locally as the one specified in this command):

    ```text
    az functionapp create --resource-group xlwings-server-rg --consumption-plan-location westeurope --runtime python --runtime-version 3.11 --functions-version 4 --name xlwings-server --os-type linux --storage-account xlwingsserversa
    ```

4.  Set the required environment variables. Make sure to provide your own license key at the end of the command (you can get a free trial key [here](https://www.xlwings.org/trial)):

    ```text
    az functionapp config appsettings set --name xlwings-server --resource-group xlwings-server-rg --settings XLWINGS_ENVIRONMENT=prod XLWINGS_ENABLE_SOCKETIO=false XLWINGS_LICENSE_KEY=<YOUR_LICENSE_KEY>
    ```

5.  Run the following to enable the worker process to index the functions:

    ```text
    az functionapp config appsettings set --name xlwings-server --resource-group xlwings-server-rg --settings AzureWebJobsFeatureFlags=EnableWorkerIndexing
    ```

6.  Deploy the function app (this is also the command to deploy an update):

    ```text
    func azure functionapp publish xlwings-server
    ```

    It should terminate with the following message:

    ```text
    Remote build succeeded!
    [...] Syncing triggers...
    Functions in xlwings-server:
       http_app_func - [httpTrigger]
          Invoke url: https://xlwings-server.azurewebsites.net//{*route}
    ```

## Logging

For app logs, in Azure portal go to:
`Function App` > `My Function App`. Then, under `http_app_func`, click on `Invocations and more`.

## Cleanup

After running this tutorial you can get rid of all the resources again by running:

```text
az group delete --name xlwings-server-rg
```

## Limitations

- Azure functions don't support WebSockets, i.e., streaming functions won't work.
- The function is always called `http_app_func`, see https://github.com/Azure-Samples/fastapi-on-azure-functions/issues/31
