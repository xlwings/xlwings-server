import os
import sys
from pathlib import Path

import uvicorn


def main():
    """Entry point for xlwings-server CLI"""

    # Get project directory (where user runs the command)
    project_dir = Path.cwd()

    # Validate project structure
    custom_functions_dir = project_dir / "custom_functions"
    custom_scripts_dir = project_dir / "custom_scripts"

    if not custom_functions_dir.exists() or not custom_scripts_dir.exists():
        print(
            "Error: Project must have custom_functions/ and custom_scripts/ directories"
        )
        sys.exit(1)

    # Set environment variable so app can find project directory
    # The sys.path manipulation will happen in main.py before importing user modules
    os.environ["XLWINGS_PROJECT_DIR"] = str(project_dir)

    # Determine SSL certificate paths
    is_cloud = os.getenv("CODESPACES") or os.getenv("GITPOD_WORKSPACE_ID")
    ssl_keyfile_path = project_dir / "certs" / "localhost+2-key.pem"
    ssl_certfile_path = project_dir / "certs" / "localhost+2.pem"

    ssl_keyfile = (
        str(ssl_keyfile_path) if ssl_keyfile_path.exists() and not is_cloud else None
    )
    ssl_certfile = (
        str(ssl_certfile_path) if ssl_certfile_path.exists() and not is_cloud else None
    )

    if (ssl_keyfile is None or ssl_certfile is None) and not is_cloud:
        print(
            "NO SSL KEYFILE OR CERTFILE FOUND. RUNNING ON HTTP, NOT HTTPS!.\n"
            "THIS WILL ONLY WORK WITH VBA AND OFFICE SCRIPTS, BUT NOT WITH "
            "OFFICE.JS ADD-INS!"
        )

    # Start uvicorn server
    # Note: We don't import settings here to avoid caching the xlwings_server module
    # before sys.path manipulation
    uvicorn.run(
        "xlwings_server.main:main_app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[str(project_dir)],
        reload_includes=[".env"],
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
    )


if __name__ == "__main__":
    main()
