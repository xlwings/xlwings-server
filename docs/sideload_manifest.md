# Sideload Manifest

Open the URL of your server in a web browser, which should show `{"status": "ok"}`. If you run this on localhost, the URL would be: https://127.0.0.1:8000.
Append the following to the URL: `/manifest` so that the URL on localhost would become https://127.0.0.1:8000/manifest. Copy the content and paste it in a file that you call`manifest.xml`. You can actually call it anything you want, but I will refer to it as `manifest.xml`.

8. Sideload the `manifest.xml` according to the following instructions:

   - [Excel on Windows](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/create-a-network-shared-folder-catalog-for-task-pane-and-content-add-ins)
   - [Excel on macOS](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)
   - [Excel on the web](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing#manually-sideload-an-add-in-to-office-on-the-web)
