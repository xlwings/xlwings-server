# xlwings Server

xlwings Server adds Python support to Microsoft Excel without the need of a local Python installation. xlwings Server is self-hosted and runs everywhere where Python runs, including bare-metal servers, Linux-based VMs, Docker, Kubernetes and serverless products like Azure functions or AWS Lambda.

xlwings Server can be used with various clients:

- [Office.js (recommended)](clients.md#officejs-add-in-recommended)
- [VBA](clients.md#vba)
- [Office Scripts](clients.md#office-scripts)
- [Google Apps Script for Google Sheets](clients.md#google-sheets)




```{toctree}
:maxdepth: 2
:caption: Introduction
:hidden:

quickstart
features
examples
```

```{toctree}
:maxdepth: 2
:caption: Server Development
:hidden:

initial_setup
dev_server
server_configuration
dependencies
upgrade
dev_docker
github_codespaces
gitpod
```

```{toctree}
:maxdepth: 2
:caption: Client Development
:hidden:

clients
manifest
taskpane
client_configuration
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
:caption: Deployment
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
api_coverage
limitations
license
