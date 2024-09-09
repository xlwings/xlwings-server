# Sideload Manifest

Open the URL of your server in a web browser, which should show `{"status": "ok"}`. If you run this on localhost, the URL would be: https://127.0.0.1:8000.

Append `/manifest` to the URL so on localhost it would become https://127.0.0.1:8000/manifest. Copy the content and paste it in a file that you call`manifest-dev.xml` or something similar.

Sideload the manifest according to the following instructions:

- [Excel on Windows](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/create-a-network-shared-folder-catalog-for-task-pane-and-content-add-ins)
- [Excel on macOS](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)
- [Excel on the web](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing#manually-sideload-an-add-in-to-office-on-the-web)

Note that for each environment (dev, qa, staging, prod), you will need an own manifest.
