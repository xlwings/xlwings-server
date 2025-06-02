# Azure Container Apps

This guide shows how to deploy xlwings Server to Azure Container Apps. You can use the [](#azure-dashboard) or the [](#azure-cli) or a combination of the two approaches.

## Prerequisites

You'll need to build a Docker image and push it to a registry such as Docker Hub or Azure Container Registry. Ideally, you do this via a CI/CD pipeline ([](#azure-dashboard) allows you to automatically add a GitHub actions workflow), but for a quick test, you could also run the commands manually. From the root of the repo, run the following commands, which will build the Docker image based on `Dockerfile`:

```
docker login
docker build -t yourusername/xlwings-server:main .
docker push yourusername/xlwings-server:main
```

Once your image is available on Docker Hub or Azure Container Registry, you can continue with either the [](#azure-cli) or [](#azure-dashboard) instructions.

## Azure Dashboard

1. Get an [xlwings trial license key](https://www.xlwings.org/trial)
2. Go to https://portal.azure.com/
3. Search for `Container Apps` and click on it.
4. `+ Create` > `+ Container App`

   - Container app name: e.g. `xlwings Server`
   - Deployment source: `Container image`
   - Select the desired `Region`, `Resource group`, and `Container Apps environment`. You may have to create the `Resource group` and `Environment` first.
   - Click on `Next: Container`, then select the appropriate settings to find your image from the prerequisites. The following are sample settings that work with the public image of xlwings Server:
   - Image source: `Docker Hub or other registries`
   - Image type: `Public`
   - Registry login server: `docker.io`
   - Image and tag: `xlwings/xlwings-server:0.11.1`
   - Command override: `/bin/sh`
   - Arguments override: `-c, gunicorn app.main:main_app --bind 0.0.0.0:8000 --access-logfile - --workers 4 --timeout 30 --worker-class uvicorn.workers.UvicornWorker`
   - CPU and memory: `2 CPU cores, 4 Gi memory`
   - Environment variables: `XLWINGS_LICENSE_KEY`: `your-license-key`
   - Click on `Next: Ingress`
   - Select `Enabled`
     - Set the appropriate values under `Ingress traffic`
     - Set `Target port` to `8000`
   - Click on `Next: Tags`
   - Click on `Next: Review + create`
   - Click on `Create`

5. Under `Application` > `Scale`, you can set the `Min replicas` and `Max replicas` both to `1`.
6. Go to your Application Url. You should see `{"status": "ok"}`.
7. Continue with [](#add-in-installation)

## Azure CLI

### Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`)
- An xlwings [license key](https://www.xlwings.org/trial)

### Setup Environment Variables

Note that some of these values _have_ to be changed, as they have to be globally unique.

```bash
export RESOURCE_GROUP_NAME="xlwings-server-rg"
export APP_NAME="xlwings-server"
export ENVIRONMENT_NAME="xlwings-server-env"
export LOCATION="westeurope"
export CONTAINER_IMAGE_NAME="xlwings/xlwings-server:0.11.1"
export REGISTRY_SERVER="docker.io"
export REGISTRY_USERNAME="your-user-name"
export REGISTRY_PASSWORD="your-password"
export XLWINGS_LICENSE_KEY="your-license-key-here"
```

### Deployment Steps

1. Create Resource Group if you don't want to reuse an existing one

   ```bash
   az group create \
     --name $RESOURCE_GROUP_NAME \
     --location $LOCATION
   ```

2. Create Container Apps Environment if you don't want to reuse an existing one (you may need to specify more options if you want to expose this on an virtual network)

   ```bash
   az containerapp env create \
     --name $ENVIRONMENT_NAME \
     --resource-group $RESOURCE_GROUP_NAME \
     --location $LOCATION
   ```

3. Create Container App

   ```bash
   az containerapp create \
     --name $APP_NAME \
     --resource-group $RESOURCE_GROUP_NAME \
     --image $CONTAINER_IMAGE_NAME \
     --registry-server $REGISTRY_SERVER \
     --registry-username $REGISTRY_USERNAME \
     --registry-password $REGISTRY_PASSWORD \
     --environment $ENVIRONMENT_NAME \
     --env-vars XLWINGS_LICENSE_KEY=$XLWINGS_LICENSE_KEY \
     --min-replicas 1 \
     --max-replicas 1 \
     --cpu 2.0 \
     --memory 4.0Gi \
     --target-port 8000 \
     --ingress external
   ```

   ```{note}
   This will expose the application to the public internet. If you have an Azure Virtual Network, you have to set `--ingress internal`.
   ```

4. Continue with [](#add-in-installation)

### View Application Logs

```bash
az containerapp logs show \
 --name $APP_NAME \
 --resource-group $RESOURCE_GROUP_NAME \
 --follow
```

### Cleanup

If you want to get rid of everything again that you created in this CLI walkthrough, you can delete all resources like so:

```bash
az group delete --name $RESOURCE_GROUP_NAME --yes --no-wait
```

## Add-in installation

1. Go to `<Application Url>/manifest.xml`. In your browser, go to `File` > `Save Page As` (or similar) and save the XML file somewhere locally, e.g., under the name `manifest-xlwings-server.xml`. It's a good idea to open the XML file in an editor and double-check that e.g., `<IconUrl>` contains the correct Application Url.
2. Go to [Microsoft 365 admin center](https://admin.microsoft.com/)
   - Click on [`Show all` > `Settings` > `Integrated Apps`](https://admin.microsoft.com/#/Settings/IntegratedApps), then click on `Upload custom apps`.
   - As `App type` select `Office Add-in`.
   - Select `Upload manifest file (.xml) from device`. Click `Choose File`, then select the `manifest-xlwings-server.xml` from the previous step.
   - Click `Next`, then assign the desired users.
   - Click `Next` and accept permission requests.
   - Click `Next` and `Finish deployment`.

The users should get the add-in to show up automatically although it may take a few minutes until they show up. Alternatively, they can go to `Add-ins` on the ribbon's `Home` tab and click on `More Add-ins`. They will see the add-in under the tab `Admin Managed` from where they can install it (there's also a `Refresh` button at the top right).
