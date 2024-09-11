# Local Development

## Prerequisites

- Install Python

## Running the development server

1. [Clone the xlwings Server repo](repo_setup.md)
2. If you want to use Office.js add-ins, you need to first [create development certificates](dev_certificates.md). If you will be using VBA, Office Scripts, or Google Apps Script, you can skip this step.
3. In a Terminal/Command Prompt, with the correct Python environment activated, run:

   ```
   python run.py
   ```

   You should see something like this:

   ```
   INFO:     Will watch for changes in these directories: ['/Users/username/dev/xlwings-server']
   INFO:     Uvicorn running on https://127.0.0.1:8000 (Press CTRL+C to quit)
   INFO:     Started reloader process [68315] using WatchFiles
   INFO:     Started server process [68317]
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   ```

4. Open https://127.0.0.1:8000 in a browser. You should see `{"status": "ok"}`.
