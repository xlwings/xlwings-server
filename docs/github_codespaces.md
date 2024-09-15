# GitHub Codespaces

GitHub Codespaces offer a quick way to create a development environment without having to install anything.

```{note}
Since you will have to expose the web server publicly, you should only use it for testing things out with non-sensitive content, like the included examples.
```

1. Go to the GitHub repo: https://github.com/xlwings/xlwings-server.
2. Click on the green `Code` button, select the `Codespaces` tab, then click on `Create codespace on main`. After a couple of minutes, you will have VS Code running in your browser with all dependencies installed.
3. In the Terminal at the bottom of VS Code, run: `python run.py init`.
4. Open the `.env` file and paste your [xlwings trial key](https://www.xlwings.org/trial) at the top of the file, under `XLWINGS_LICENSE_KEY`.
5. in the Terminal, run: `python run.py`, you should see something like this:

   ```text
   @fzumstein ➜ /workspaces/xlwings-server (main) $ python run.py
   INFO:     Will watch for changes in these directories: ['/workspaces/xlwings-server']
   INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
   INFO:     Started reloader process [5283] using WatchFiles
   INFO:     Started server process [5285]
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   ```

6. You should also get a pop-up at the bottom-right corner: `Your application running on port 8000 is available`. Click on `Make Public`.
7. Next to `Terminal`, click on the `Ports` tab where you'll see the `Forwarded Address`. Hover over it and click the globe icon: this will open the page on a new tab. You should see `{"status": "ok"}`.
