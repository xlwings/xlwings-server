# Install Office.js add-ins

An Office.js add-in is defined via its manifest, which is a simple configuration file in the `XML` format. There are 3 different ways how you can install a manifest in Excel:

- **Development and testing**: install the manifest manually via [](#sideloading).
- **Internal production deployment**: deploy the manifest centrally via [](#microsoft-365-admin-center).
- **Public production deployment**: publish the manifest to the [](#office-add-in-store).

```{note}
Each xlwings Server environment (dev, qa, prod, ...) has its an own manifest.
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

## Microsoft 365 admin center

- In your [Microsoft 365 admin center](https://admin.microsoft.com/), click on `Show all` > `Settings` > `Integrated Apps` > `Upload custom apps`.
- As `App type` select `Office Add-in`.
- Choose how to upload app: the easiest way is to activate `Provide link to manifest file` and point to `https://YOUR_SERVER_URL/manifest` (make sure that this endpoint is publicly accessible and not e.g., blocked for certain IP addresses). Click on `Validate`, then on `Next` where you'll be able to select the users you want to deploy the add-in to. Alternatively, you can also copy/paste the content of `https://<YOUR SERVER>/manifest` into a file that you call `xlwings-server-prod.xml` or something similar, then upload it via `Choose File`.

The users should get the add-in to show up automatically. Alternatively, they can go to `Add-ins` on the ribbon's `Home` tab and click on `More Add-ins`. They will see the add-in under the tab `Admin Managed` from where they can install it.

## Office add-in store

To publish an add-in to the Office add-in store, you will need to become a [Microsoft Partner](https://partner.microsoft.com/).

Make sure that you set the following setting with xlwings Server:

```ini
XLWINGS_PUBLIC_ADDIN_STORE=true
```

This ensures that the `office.js` library will be loaded via CDN instead of from xlwings Server as per Microsoft's requirements.

For further details, see [Make your solutions available in Microsoft AppSource and within Office](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/submit-to-appsource-via-partner-center).

```{note}
The Excel add-in store is sometimes also referred to as *AppSource*.
```

## Further reading

- [Deploy and publish Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/publish/publish)
