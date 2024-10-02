# Install Office.js add-ins

An Office.js add-in is defined via its _manifest_, which is a simple configuration file in the `XML` format. There are 3 different ways how you can install a manifest in Excel:

- **Development and testing**: install the manifest manually via [](#sideloading).
- **Internal production deployment**: deploy the manifest centrally via [](#microsoft-365-admin-center).
- **Public production deployment**: publish the manifest to the [](#office-add-in-store-appsource).

```{note}
Each xlwings Server environment (`dev`, `prod`, ...) has an own manifest as exposed via `https://your.domain.com/manifest`.
```

## Sideloading

In a browser, go to `https://YOUR_SERVER_URL/manifest`. Copy the content and paste it in a file that you call`xlwings-server-dev.xml` or something similar.

Sideload the manifest according to the following instructions:

- [Excel on Windows](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/create-a-network-shared-folder-catalog-for-task-pane-and-content-add-ins)
- [Excel on macOS](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)
- [Excel on the web](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing#manually-sideload-an-add-in-to-office-on-the-web)

In Excel, go to `Add-ins` on the ribbon's `Home` tab:

- **Windows**: click on `More Add-ins` > `Shared Folder`. From here, you can install the add-in. Note that the add-in will stick around, even if you restart Excel.
- **macOS**: you will see your add-in listed under `Developer add-ins`. Note that you will have to activate the add-in every time you restart Excel.
- **Web**: The add-in will be available directly after uploading it.

## Microsoft 365 admin center

- In your [Microsoft 365 admin center](https://admin.microsoft.com/), click on [`Show all` > `Settings` > `Integrated Apps`](https://admin.microsoft.com/#/Settings/IntegratedApps), then click on `Upload custom apps`.
- As `App type` select `Office Add-in`.
- Choose how to upload the app: the easiest way is to activate `Provide link to manifest file` and point to `https://YOUR_SERVER_URL/manifest` (make sure that this endpoint is publicly accessible and not e.g., only accessible internally). Click on `Validate`, then on `Next` where you'll be able to select the users you want to deploy the add-in to. Alternatively, you can also copy/paste the content of `https://<YOUR SERVER>/manifest` into a file that you call `xlwings-server-prod.xml` or something similar, then upload it via `Choose File`.

The users should get the add-in to show up automatically although it may take a few minutes until they show up. Alternatively, they can go to `Add-ins` on the ribbon's `Home` tab and click on `More Add-ins`. They will see the add-in under the tab `Admin Managed` from where they can install it.

## Office add-in store ("AppSource")

To publish an add-in to the Office add-in store, you will need to become a [Microsoft Partner](https://partner.microsoft.com/).

Make sure that you set the following setting with xlwings Server:

```ini
XLWINGS_PUBLIC_ADDIN_STORE=true
```

This ensures that the `office.js` library will be loaded via CDN as per Microsoft's requirements.

For further details, see [Make your solutions available in Microsoft AppSource and within Office](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/submit-to-appsource-via-partner-center).

## Clearing the Office cache

Sometimes, Excel gets confused when you update a manifest and it doesn't show the changes correctly or opens a different version of the add-in. In these cases, clear the office cache:

- On Windows, in the Excel ribbon, go to `File` > `Options` > `Trust Center` > `Trust Center Settings` > `Trusted Add-in Catalogs`. Now select the checkbox `Next time Office starts, clear all previously-started web add-ins cache` and restart Excel.
- On macOS, run the following in a Terminal:

  ```
  bash scripts/clear_office_cache_macos.sh
  ```

  then restart Excel.

## Further reading

- [Deploy and publish Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/publish)
