"""
Azure Functions

Note: Azure Functions don't support streaming functions/socket.io.

The other files required for Azure Functions are:
- host.json
- local.settings.json
- .funcignore

The function is always called http_app_func, see:
https://github.com/Azure-Samples/fastapi-on-azure-functions/issues/31

For app logs, in Azure portal go to:
Function App > My Function App. Than, under `http_app_func`, click on `Invocations and more`.
"""

import os
import sys
from pathlib import Path

import azure.functions as func

project_dir = Path(__file__).parent
if str(project_dir) not in sys.path:
    sys.path.insert(0, str(project_dir))
os.environ["XLWINGS_PROJECT_DIR"] = str(project_dir)

from app.main import main_app  # noqa: E402

app = func.AsgiFunctionApp(app=main_app, http_auth_level=func.AuthLevel.ANONYMOUS)
