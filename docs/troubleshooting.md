# Troubleshooting

## Error installing add-ins

When installing the Office.js add-in, you get the following error in the taskbar of Excel: "Addin xlwings Server failed to download a required resource".

Solution: Make sure to run your server via https, not via http by using TLS certificates. This also means that you will need to use a domain name, not the IP address directly.
