# xlwings Server

xlwings Server adds Python support to Microsoft Excel without the need of a local Python installation. xlwings Server is self-hosted and runs on any platform that supports Python or Containers, including bare-metal servers, Linux-based VMs, Docker Compose, Kubernetes, and serverless products like Azure functions or AWS Lambda. Here are a few highlights of xlwings Server:

- Create modern Excel add-ins ("Office.js add-ins")---no VBA involved
- Supports Excel on Windows, Excel on macOS, and Excel on the web
- Install any Python package, including your own
- Write automation scripts and custom functions with Python instead of dealing with JavaScript, Node, and Webpack
- Develop custom task pane applications using the web technology of your choice
- Highest security: runs in air-gapped environments without internet access or connection to any Microsoft servers
- Intellectual property protection: the Python source code can't be accessed by the Excel user
- Supports SSO (single sign-on) authentication and RBAC (role-based access control) via Microsoft Entra ID (previously known as Azure AD)
- No sensitive credentials need to be stored on the end-user's computer or in the workbook
- Compatible with Python 3.10+

```{toctree}
:hidden:

quickstart
custom_functions
custom_scripts
```

```{toctree}
:maxdepth: 2
:hidden:

index_tutorials
```

<!-- ```{toctree}
:maxdepth: 2
:hidden:

index_development_environment
``` -->

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

index_authentication
```

```{toctree}
:maxdepth: 2
:hidden:

index_hosting
```

<!-- ```{toctree}
:maxdepth: 2
:hidden:

index_wasm
``` -->

```{toctree}
:maxdepth: 2
:hidden:

index_other_integrations
```

```{toctree}
:maxdepth: 2
:hidden:

migration
changelog
limitations
troubleshooting
license
```
