# Azure Functions

## Prerequisites

- Follow [](repo_setup.md) or simply clone the [xlwings Server Repo](https://github.com/xlwings/xlwings-server) if you just want to deploy xlwings Server for a quick test.

Install the following software:

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)

Before you begin, you'll need to login to Azure:

```text
az login
```

```{note}
If you deploy to Azure Functions using a different method, you should be able to adapt the instructions accordingly.
```

## Files

The following files are part of Azure functions setup and may need to be tweaked:

- `host.json`
- `local.settings.json`
- `function_app.py`
- `.funcignore`

## Deployment

In the commands below, we're going to use the following parameters that you should adjust to match your preferences:

- The function app: `xlwings-server`
- The resource group: `xlwings-server-rg`
- The storage account: `xlwingsserversa`
- Region: `westeurope`

```{important}
You need to replace `xlwings-server` with your own app name in all of the the following commands as the name needs to be globally unique.
```

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

4.  Set the required environment variables. Make sure to provide your own license key at the end of this command (you can get a free trial key [here](https://www.xlwings.org/trial)). You'll also need to adjust the `XLWINGS_ENVIRONMENT` if this is not the `prod` environment:

    ```text
    az functionapp config appsettings set --name xlwings-server --resource-group xlwings-server-rg --settings XLWINGS_ENVIRONMENT=prod XLWINGS_ENABLE_SOCKETIO=false XLWINGS_LICENSE_KEY=<YOUR_LICENSE_KEY>
    ```

5.  Run the following to enable the worker process to index the functions:

    ```text
    az functionapp config appsettings set --name xlwings-server --resource-group xlwings-server-rg --settings AzureWebJobsFeatureFlags=EnableWorkerIndexing
    ```

6.  Deploy the function app (this is also the command to deploy an update):

    ```{important}
    This command must be run from the root of your xlwings-server repo.
    ```

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

If there's nothing printed after `Functions in ...`, have a look at [](#logging) to find out the reason, otherwise go to the URL without the `//{*route}` part (in the example, that would be `https://xlwings-server.azurewebsites.net`) and you should see `{"status": "ok"}`.

## Logging

- If your app correctly deploys including syncing triggers, you can look at the runtime logs in Azure portal like so:
  `Function App` > `My Function App`. Then, under `http_app_func`, click on `Invocations and more`.

- If your Azure functions doesn't manage to sync triggers, i.e., it doesn't print a URL after running `func azure functionapp publish`, you need to go to the Azure portal:
  `Function App` > `My Function App`. In the left-hand menu, select `Diagnose and solve problems` > `Availability and Performance` and finally click on `Functions that are not triggered` on the left-hand side.

## Cleanup

After running this tutorial you can get rid of all the resources again by running:d

```text
az group delete --name xlwings-server-rg
```

## Limitations

- Azure functions don't support WebSockets, i.e., streaming functions won't work.
- The function is always called `http_app_func`, see https://github.com/Azure-Samples/fastapi-on-azure-functions/issues/31
