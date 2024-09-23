# xlwings Server

xlwings Server adds Python support to Microsoft Excel and Google Sheets without the need of a local Python installation. xlwings Server is self-hosted and runs on any platform that supports Python or Docker, including bare-metal servers, Linux-based VMs, Docker Compose, Kubernetes and serverless products like Azure functions or AWS Lambda. Here are a few highlights:

- Compatible with Python 3.9+
- Compatible with all Excel platforms, including Excel on Windows and macOS, and Excel on the web
- Compatible with all Python packages, including custom ones and those from private registries
- Supports custom scripts and custom functions including streaming functions and object handles
- Allows you to develop modern Office.js add-ins by writing Python code instead of JavaScript
- In addition to Office.js add-ins, you can also use VBA, Office Scripts, and Google Apps Script to talk from Excel to your server. These, however, don't support custom functions.
- Runs in air-gapped environments without Internet access or connection to any Microsoft servers
- Intellectual property protection: the Python source code can't be accessed by the Excel user.
- Supports SSO (single sign-on) authentication and RBAC (role-based access control) via Microsoft Entra ID (previously known as Azure AD)
- No sensitive credentials need to be stored on the end-user's computer or in the workbook
- No dependency on Node.js or Webpack even when using Office.js add-ins
- Built with FastAPI, a high-performance, async web framework
- Comes optionally with htmx (client-server interaction), Alpine.js (for client interactions), Socket.io (for streaming functions), and Bootstrap-xlwings (Bootstrap theme in the Excel look)
- Full source code is on [GitHub](https://github.com/xlwings/xlwings-server) allowing for complete customization
- xlwings Server is free for non-commercial use---commercial use requires a [paid plan](https://www.xlwings.org/pricing)

```{toctree}
:maxdepth: 2
:caption: Introduction
:hidden:

quickstart
examples
excel_integrations
```

```{toctree}
:maxdepth: 2
:caption: Tutorials
:hidden:

custom_functions
custom_scripts
authentication
missing_features
performance
```

```{toctree}
:maxdepth: 2
:caption: Server Development
:hidden:

repo_setup
local_development
dev_docker
github_codespaces
devcontainers
gitpod
dev_certificates
tunneling
server_config
dependencies
upgrade
```

```{toctree}
:maxdepth: 2
:caption: Office.js Add-ins
:hidden:

install_officejs_addin
manifest
debugging
taskpane
excel_integration_config
static_site_generators
```

```{toctree}
:maxdepth: 2
:caption: Other integrations
:hidden:

vba_integration
officescripts_integration
googleappsscript_integration
```

```{toctree}
:maxdepth: 2
:caption: Deployment
:hidden:

deployment
```

```{toctree}
:maxdepth: 2
:caption: Hosting
:hidden:

azure_functions
docker_compose
aws_app_runner
render
```

```{toctree}
:maxdepth: 2
:caption: About
:hidden:

changelog
limitations
license
```
