# Quick Start

## 1. Get a License Key

Get a [trial license key](https://www.xlwings.org/trial) as you will need it in the next step.

## 2. Run the Server

You can either create a development environment or deploy to "production":

::::{tab-set}
:::{tab-item} Development

A development environment makes it easy to play around with your own functions, but is only accessible to a single developer.
There are many different ways to create a development environment. Some of the more popular options include:

- [](local_development.md): run xlwings Server on your laptop via a local Python installation.
- [](dev_docker.md): run xlwings Server locally via Docker Compose.
- [](github_codespaces.md): play around with a development environment in the cloud without having to install anything locally.

For more options, have a look at [](index_server.md).

:::

:::{tab-item} Production
A production environment enables multiple users to explore xlwings Server by experimenting with the included examples. Making changes or adding own functions requires a re-deployment.
You can deploy xlwings Server on any platform that supports Python or Docker. Some good options to start with are:

- [](render.md): cloud-based service that allows you to deploy xlwings Server for free in less than 1 minute.
- [](azure_functions.md): a popular choice for companies that use Azure as their cloud platform.
- [](docker_compose.md): spin up xlwings Server via Docker Compose on a Linux VM.

There are many more ways how you can deploy to production according to your preferences, see [](index_hosting.md).

:::
::::

## 3. Set up an Integration

xlwings Server supports various integrations ("clients") that connect Excel or Google Sheets to your server. While Office.js add-ins are recommended in an enterprise context, reviewing the [pros and cons](integrations.md) of each integration will help you make the right choice. Note, however, that only Office.js add-ins support custom functions and SSO authentication. Click on your desired integration to learn how to set it up:

- [Office.js add-ins](install_officejs_addin.md)
- [](vba_integration.md)
- [](officescripts_integration.md)
- [](googleappsscript_integration.md)

## 4. Take it for a Spin!

Now you are ready to play around with the provided [examples](examples.md)!

## 5. Next steps

Check out the tutorials on [](custom_functions.md) and [](custom_scripts.md) for more detailed information.
