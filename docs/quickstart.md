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

- [](render.md): cloud-based service that allows you to deploy xlwings Server for free in less than 1 minute by using the official Docker image.
- [](azure_functions.md): a popular choice for companies that use Azure as their cloud platform.
- [](docker_compose.md): spin up xlwings Server via Docker Compose on a Linux VM.

There are many more ways how you can deploy to production according to your preferences, see the `Hosting` section.

## 3. Prepare Excel

xlwings Server supports various _clients_ that connect Excel with your server. While Office.js add-ins are recommended, you will find the pros and cons of all of them in the [](clients.md).

Once you know which client you're going to use, you can jump right into the corresponding docs:

- [Office.js Client (recommended)](install_manifest.md)
- [](vba_client.md)
- [](officescripts_client.md)
- [](googleappsscript_client.md)

## 4. Play time

Now you are ready to play around with the provided examples!

### Office.js client

- **Custom scripts**: you can click the `Hello World` buttons on the Ribbon and on the task pane. The source code is under [`app/custom_scripts/examples.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_scripts/examples.py).
- **Custom functions**: in a cell, type: `=XLWINGS.HELLO("world")`. You should see: `Hello world!`. There are a few other (more interesting) examples available that you should see when typing `=XLWINGS.`. The source code is under [`app/custom_functions/examples.py`](https://github.com/xlwings/xlwings-server/blob/main/app/custom_functions/examples.py).
- **Task pane**: There are various examples of task pane functionality under [`app/templates/examples`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples).

### VBA, Office Scripts, and Google Apps Scripts clients

- **Custom scripts**: If you want to call scripts from Office Scripts, or Google Apps Script, you will need to use the `runPython` function with the following endpoint (make sure to use your actual URL):

  ```js
  runPython("http://127.0.0.1:8000/xlwings/custom-scripts-call/hello_world");
  ```

  To call it from VBA, use:

  ```vb.net
  RunRemotePython("http://127.0.0.1:8000/xlwings/custom-scripts-call/hello_world")
  ```

- **Custom functions**: only supported with Office.js clients.
