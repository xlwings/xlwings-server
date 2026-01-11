import argparse
import os
import sys
import uuid
from pathlib import Path
from textwrap import dedent

import uvicorn


def create_project_structure(project_path: Path):
    """Create minimal project structure"""
    # Create project directory if it doesn't exist
    project_path.mkdir(parents=True, exist_ok=True)

    # Create required directories
    (project_path / "custom_functions").mkdir(exist_ok=True)
    (project_path / "custom_scripts").mkdir(exist_ok=True)
    (project_path / "templates").mkdir(exist_ok=True)

    # Create __init__.py files with imports
    functions_init = project_path / "custom_functions" / "__init__.py"
    if not functions_init.exists():
        functions_init.write_text(
            "# Import your custom functions here\nfrom .functions import *\n"
        )

    scripts_init = project_path / "custom_scripts" / "__init__.py"
    if not scripts_init.exists():
        scripts_init.write_text(
            "# Import your custom scripts here\nfrom .scripts import *\n"
        )

    # Create sample files
    create_sample_functions(project_path)
    create_sample_scripts(project_path)
    create_sample_taskpane(project_path)


def create_sample_functions(project_path: Path):
    """Create sample functions.py file with hello function"""
    functions_file = project_path / "custom_functions" / "functions.py"

    if functions_file.exists():
        return

    sample_code = dedent("""
        from xlwings import func


        @func
        def hello(name):
            return f"Hello {name}!"
    """)

    functions_file.write_text(sample_code)


def create_sample_scripts(project_path: Path):
    """Create sample scripts.py file with hello_world script"""
    scripts_file = project_path / "custom_scripts" / "scripts.py"

    if scripts_file.exists():
        return

    sample_code = dedent("""
        import xlwings as xw
        from xlwings import script


        @script
        def hello_world(book: xw.Book):
            sheet = book.sheets.active
            cell = sheet["A1"]
            if cell.value == "Hello xlwings!":
                cell.value = "Bye xlwings!"
            else:
                cell.value = "Hello xlwings!"
    """)

    scripts_file.write_text(sample_code)


def create_sample_taskpane(project_path: Path):
    """Create sample taskpane.html template"""
    taskpane_file = project_path / "templates" / "taskpane.html"

    if taskpane_file.exists():
        return

    sample_html = dedent("""
        {% extends "base.html" %}

        {% block content %}
        <div class="container-fluid pt-3 ps-3">
            <h1>{{ settings.project_name }}</h1>
            <button xw-click="hello_world" class="btn btn-primary btn-sm" type="button">
            Write 'Hello/Bye xlwings!' to A1
            </button>
        </div>
        {% endblock content %}
    """)

    taskpane_file.write_text(sample_html)


def create_dotenv(project_path: Path):
    """Copy .env.template from package to project as .env"""
    import shutil

    from xlwings_server.config import PACKAGE_DIR

    env_template_path = PACKAGE_DIR / ".env.template"
    env_path = project_path / ".env"

    if env_path.exists():
        return

    shutil.copy(env_template_path, env_path)


def create_uuids(project_path: Path | None = None):
    """Generate manifest UUIDs in pyproject.toml"""
    import tomlkit

    project_dir = project_path or Path.cwd()
    pyproject_path = project_dir / "pyproject.toml"

    if not pyproject_path.exists():
        # Create a minimal pyproject.toml
        data = tomlkit.document()
        data["tool"] = {}
        data["tool"]["xlwings_server"] = {}
    else:
        # Read existing pyproject.toml with tomlkit to preserve formatting
        content = pyproject_path.read_text()
        data = tomlkit.parse(content)

    # Check if UUIDs already exist
    if "tool" in data and "xlwings_server" in data["tool"]:
        existing_config = data["tool"]["xlwings_server"]
        if "manifest_id_dev" in existing_config:
            # Don't overwrite existing UUIDs
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


def init_command(path: str | None = None):
    """Initialize project - run all initialization tasks"""
    # Determine project path
    if path is None or path == ".":
        project_path = Path.cwd()
    else:
        project_path = Path(path).resolve()

    # Create project structure
    create_project_structure(project_path)

    # Create .env file
    create_dotenv(project_path)

    # Generate UUIDs in pyproject.toml
    create_uuids(project_path)

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
    is_cloud = os.getenv("CODESPACES")
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
    init_parser = subparsers.add_parser(
        "init",
        help="Initialize project - create structure and generate manifest UUIDs",
    )
    init_parser.add_argument(
        "path",
        nargs="?",
        default=None,
        help="Project path (default: current directory). Use '.' for current directory or specify a path to create a new project.",
    )

    args = parser.parse_args()

    if args.command == "init":
        init_command(args.path)
    else:
        # Default: run server
        run_server()


if __name__ == "__main__":
    main()
