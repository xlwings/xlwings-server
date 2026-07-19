# Troubleshooting

## Clear your Office cache

If the add-in behaves unexpectedly, clearing the Office cache is often the right fix.

::::{tab-set}

:::{tab-item} Windows
:sync: windows

1. Go to `File` > `Options` > `Trust Center` > `Trust Center Settings` > `Trusted Add-in Catalogs`
2. Activate the checkbox `Next time Office starts, clear all previously-started web add-ins cache.`, then click `OK`.
3. Restart Excel

Alternatively:

1. Close Excel
2. Delete the following folder:

```text
%LOCALAPPDATA%\Microsoft\Office\16.0\Wef
```

:::

:::{tab-item} macOS
:sync: macos

- Close Excel via `Cmd+Q`
- Run the following commands in a Terminal:

```text
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Caches/
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Application
rm -rf ~/Library/Containers/com.microsoft.Office365ServiceV2/Data/Caches/com.microsoft.Office365ServiceV2/
rm -rf ~/Library/Containers/com.microsoft.Office365ServiceV2/Data/Library/Caches/com.microsoft.Office365ServiceV2/
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Application\ Support/Microsoft/Office/16.0/Wef/
```

:::

::::

See also: https://learn.microsoft.com/en-us/office/dev/add-ins/testing/clear-cache

## Addin xlwings Server failed to download a required resource

When installing the Office.js add-in, you get the following error in the taskbar of Excel: "Addin xlwings Server failed to download a required resource".

Solution: Make sure to run your server via https, not via http by using TLS certificates. This also means that you will need to use a domain name, not the IP address directly.

## The cell shows `#NAME?` or `#BUSY!` when using custom functions

Clear your Office cache, see [](#clear-your-office-cache)
