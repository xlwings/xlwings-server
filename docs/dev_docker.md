# Docker-based Development

Docker is a great way to quickly fire up a local development environment without having to install Python locally.

## Prerequisites

Install [Docker](https://www.docker.com/) and double-check that you can run the following two commands on a Terminal/Command Prompt:

```
docker
docker compose
```

## Running the development server

1. [Clone the xlwings Server repo](repo_setup.md)
2. If you want to use Office.js add-ins, you need to first [create development certificates](dev_certificates.md). If you will be using VBA, Office Scripts, or Google Apps Script, you can skip this step.
3. In the root of the repo, run:

   ```
   docker compose up
   ```

   If you run this for the first time, it will build the development container first, then start the server. In the end, you should see something like this in your Terminal:

   ```
   ✔ Network xlwings-server_default  Created                                                                                                              0.0s
   ✔ Container xlwings-server-app-1  Created                                                                                                              0.0s
   Attaching to app-1
   app-1  | INFO:     Will watch for changes in these directories: ['/project/app']
   app-1  | INFO:     Uvicorn running on https://0.0.0.0:8000 (Press CTRL+C to quit)
   app-1  | INFO:     Started reloader process [1] using WatchFiles
   app-1  | INFO:     Started server process [8]
   app-1  | INFO:     Waiting for application startup.
   app-1  | INFO:     Application startup complete.
   ```

4. Open https://127.0.0.1:8000 in a browser. You should see `{"status": "ok"}`.
5. Only if you are using the Office Scripts or Google Apps Script clients: set up [](tunneling.md). If you are using the Office.js or VBA clients, you can skip this step.
