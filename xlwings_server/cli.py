import argparse
import os
import sys
import uuid
from pathlib import Path

import uvicorn


def create_uuids():
    """Generate manifest UUIDs in pyproject.toml"""
    import tomlkit

    project_dir = Path.cwd()
    pyproject_path = project_dir / "pyproject.toml"

    if not pyproject_path.exists():
        print("Error: pyproject.toml not found in current directory")
        sys.exit(1)

    # Read existing pyproject.toml with tomlkit to preserve formatting
    content = pyproject_path.read_text()
    data = tomlkit.parse(content)

    # Check if UUIDs already exist
    if "tool" in data and "xlwings_server" in data["tool"]:
        existing_config = data["tool"]["xlwings_server"]
        if "manifest_id_dev" in existing_config:
            # Don't overwrite existing UUIDs
            print("Manifest UUIDs already exist in pyproject.toml")
            return
    else:
        if "tool" not in data:
            data["tool"] = {}
        data["tool"]["xlwings_server"] = {}

    # Generate new UUIDs
    manifest_ids = {
        "manifest_id_dev": str(uuid.uuid4()),
        "manifest_id_qa": str(uuid.uuid4()),
        "manifest_id_uat": str(uuid.uuid4()),
        "manifest_id_staging": str(uuid.uuid4()),
        "manifest_id_prod": str(uuid.uuid4()),
    }

    # Add UUIDs to [tool.xlwings_server] section
    for key, value in manifest_ids.items():
        data["tool"]["xlwings_server"][key] = value

    # Write back (tomlkit preserves formatting)
    pyproject_path.write_text(tomlkit.dumps(data))
    print("Generated manifest UUIDs in pyproject.toml")


def init_command():
    """Initialize project - run all initialization tasks"""
    print("Initializing xlwings-server project...")
    create_uuids()
    print("Initialization complete!")


def run_server():
    """Start the xlwings-server development server"""
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


def main():
    """Entry point for xlwings-server CLI"""
    parser = argparse.ArgumentParser(
        description="xlwings Server - Modern Excel add-ins with Python"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Init command
    subparsers.add_parser(
        "init", help="Initialize project - generate manifest UUIDs in pyproject.toml"
    )

    args = parser.parse_args()

    if args.command == "init":
        init_command()
    else:
        # Default: run server
        run_server()


if __name__ == "__main__":
    main()
