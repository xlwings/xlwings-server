# Quickstart

## 1. License Key

Get a [trial license key](https://www.xlwings.org/trial) as you will need it in the next step.

## 2. Run the Server

You can either create a development environment or deploy to "production":

- **Development environment**: makes it easy to play around with your own functions, but is only accessible to a single developer.
- **Production environment**: enables multiple users to explore xlwings Server by experimenting with the included examples. Making changes or adding own functions requires a re-deployment.

### Development environment

There are many different ways to create a development environment. Some of the more popular options include:

- [](github_codespaces.md): play around with a development environment in the cloud without having to install anything locally.
- [](dev_docker.md): run xlwings Server locally via Docker Compose.
- [](local_development.md): run xlwings Server via a local Python installation.

For more options, have a look at the `Server Development` section.

### Production setup

You can deploy xlwings Server on any platform that supports Python or Docker. Some good options to start with are:

- [](render.md): cloud-based service that allows you to deploy xlwings Server for free in less than 1 minute.
- [](azure_functions.md): a popular choice for companies that use Azure as their cloud platform.
- [](docker_compose.md): spin up xlwings Server via Docker Compose on a Linux VM.

There are many more ways how you can deploy to production according to your preferences, see the `Hosting` section.

## 3. Excel Integration

xlwings Server supports various Excel integrations ("clients") that connect Excel with your server. While Office.js add-ins are recommended, you will find the pros and cons of all of them in the [](excel_integrations.md).

After selecting your client, you can dive straight into the relevant documentation:

- [Office.js Add-ins (recommended)](install_manifest.md)
- [](vba_client.md)
- [](officescripts_client.md)
- [](googleappsscript_client.md)

## 4. Run the Examples

Now you are ready to play around with the provided [examples](examples.md)!
