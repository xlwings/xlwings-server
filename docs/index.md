# xlwings Server

xlwings Server adds Python support to Microsoft Excel and Google Sheets without the need of a local Python installation. xlwings Server is self-hosted and runs on any platform that supports Python or Docker, including bare-metal servers, Linux-based VMs, Docker Compose, Kubernetes and serverless products like Azure functions or AWS Lambda.

If you need an even simpler deployment, you can use [](index_lite.md), which allows you to deploy your app as a static website to free services like GitHub Pages or static file servers like nginx. The ease of deployment comes with certain [limitations](lite_limitations.md) though.

Here are a few highlights of xlwings Server:

- Compatible with Python 3.9+
- Compatible with all Excel platforms, including Excel on Windows and macOS, and Excel on the web as well as Google Sheets
- Compatible with all Python packages, including your own ones and those from private registries
- Supports [custom scripts](custom_scripts.md) and [custom functions](custom_functions.md) including [streaming functions](custom_functions.md#streaming-functions-rtd-functions) and [object handles](custom_functions.md#object-handles)
- Allows you to develop modern Office.js add-ins by writing Python code instead of dealing with JavaScript, Node.js and Webpack
- In addition to Office.js add-ins, you can also use VBA, Office Scripts, and Google Apps Script to talk from Excel or Google Sheets to your server. These integrations, however, don't support custom functions.
- Highest security: runs in air-gapped environments without Internet access or connection to any Microsoft servers
- Intellectual property protection: the Python source code can't be accessed by the Excel user.
- Supports SSO (single sign-on) authentication and RBAC (role-based access control) via Microsoft Entra ID (previously known as Azure AD)
- No sensitive credentials need to be stored on the end-user's computer or in the workbook
- Built with FastAPI, a high-performance, async web framework
- Comes optionally with powerful tools for Office.js task pane development: [htmx](https://htmx.org/) (client-server interaction), [Alpine.js](https://alpinejs.dev/) (for client interactions), Socket.io (for streaming functions), and [Bootstrap-xlwings](https://getbootstrap.com/) (Bootstrap theme in the Excel look)
- Full source code is on [GitHub](https://github.com/xlwings/xlwings-server) allowing for complete customization
- Your code runs in your computing environment that you may already have available at no additional costs and it allows you to pick the computing power that you need, including GPUs
- xlwings Server is free for non-commercial use---commercial use requires a [paid plan](https://www.xlwings.org/pricing)

```{toctree}
:hidden:

quickstart
examples
integrations
```

```{toctree}
:maxdepth: 2
:hidden:

index_tutorials
```

```{toctree}
:maxdepth: 2
:hidden:

index_dev_prerequisites
```

```{toctree}
:maxdepth: 2
:hidden:

index_development_environment
```

```{toctree}
:maxdepth: 2
:hidden:

index_server
```

```{toctree}
:maxdepth: 2
:hidden:

index_officejs_addins
```

```{toctree}
:maxdepth: 2
:hidden:

index_taskpane
```

```{toctree}
:maxdepth: 2
:hidden:

index_other_integrations
```

```{toctree}
:maxdepth: 2
:hidden:

index_authentication
```

```{toctree}
:maxdepth: 2
:hidden:

index_hosting
```

```{toctree}
:maxdepth: 2
:hidden:

index_lite
```

```{toctree}
:maxdepth: 2
:hidden:

changelog
limitations
troubleshooting
alternatives
license
```
