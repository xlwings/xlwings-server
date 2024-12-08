# Troubleshooting

## Error installing add-ins

When installing the Office.js add-in, you get the following error in the taskbar of Excel: "Addin xlwings Server failed to download a required resource".

Solution: Make sure to run your server via https, not via http by using TLS certificates. This also means that you will need to use a domain name, not the IP address directly.

## Error after upgrading xlwings Server (upstream)

You pulled a new version of upstream xlwings Server and now you get errors when running the server.

Solution: You most likely missed upgrading the dependencies. After pulling in a new version of xlwings Server, always make sure to follow the [](upgrade.md) documentation. This also includes setting up the repository as shown under [](repo_setup.md) to reduce merge conflicts.
