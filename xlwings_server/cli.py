import argparse
import os
import shutil
import sys
import uuid
from pathlib import Path
from textwrap import dedent

import uvicorn

from xlwings_server.config import PACKAGE_DIR


# Helper Classes and Functions
class FileTracker:
    """Track created and skipped files during CLI operations."""

    def __init__(self):
        self.created = []
        self.skipped = []

    def mark_created(self, path: str):
        """Mark a file as created."""
        self.created.append(path)

    def mark_skipped(self, path: str):
        """Mark a file as skipped (already exists)."""
        self.skipped.append(path)

    def print_summary(self, operation_name: str):
        """Print summary of created and skipped files."""
        print(f"\n{operation_name} complete!")
        if self.created:
            print(f"Created: {', '.join(self.created)}")
        if self.skipped:
            print(f"Skipped (already exists): {', '.join(self.skipped)}")


def validate_project_directory() -> Path:
    """Validate we're in an xlwings-server project directory."""
    project_path = Path.cwd()
    if not (project_path / "custom_functions").exists():
        print("Error: Not in an xlwings-server project directory.")
        print("Run this command from your project root.")
        print("Hint: Initialize a project first with 'xlwings-server init'")
        sys.exit(1)
    return project_path


def copy_file_if_not_exists(
    source: Path,
    dest: Path,
    tracker: FileTracker,
    display_name: str | None = None,
) -> bool:
    """Copy file if it doesn't exist. Returns True if copied."""
    display_name = display_name or str(dest)
    if dest.exists():
        tracker.mark_skipped(display_name)
        return False
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(source, dest)
        tracker.mark_created(display_name)
        return True


def create_sample_file_if_not_exists(file_path: Path, content: str) -> bool:
    """Create a sample file if it doesn't exist. Returns True if created."""
    if file_path.exists():
        return False
    file_path.write_text(dedent(content))
    return True


# Project Setup Functions
def create_project_structure(project_path: Path):
    """Create minimal project structure"""
    # Create project directory if it doesn't exist
    project_path.mkdir(parents=True, exist_ok=True)

    # Create required directories
    (project_path / "custom_functions").mkdir(exist_ok=True)
    (project_path / "custom_scripts").mkdir(exist_ok=True)
    (project_path / "templates").mkdir(exist_ok=True)
    (project_path / "certs").mkdir(exist_ok=True)

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
    sample_code = """\
        from xlwings import func


        @func
        def hello(name):
            return f"Hello {name}!"
    """
    create_sample_file_if_not_exists(functions_file, sample_code)


def create_sample_scripts(project_path: Path):
    """Create sample scripts.py file with hello_world script"""
    scripts_file = project_path / "custom_scripts" / "scripts.py"
    sample_code = """\
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
    """
    create_sample_file_if_not_exists(scripts_file, sample_code)


def create_sample_taskpane(project_path: Path):
    """Create sample taskpane.html template"""
    taskpane_file = project_path / "templates" / "taskpane.html"
    sample_html = """\
        {% extends "base.html" %}

        {% block content %}
        <div class="container-fluid pt-3 ps-3">
            <h1>{{ settings.project_name }}</h1>
            <button xw-click="hello_world" class="btn btn-primary btn-sm" type="button">
            Write 'Hello/Bye xlwings!' to A1
            </button>
        </div>
        {% endblock content %}
    """
    create_sample_file_if_not_exists(taskpane_file, sample_html)


def add_router_command():
    """Add router directory and sample router to project"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    # Create routers directory
    routers_dir = project_path / "routers"
    routers_dir.mkdir(exist_ok=True)

    # Create __init__.py (empty)
    init_file = routers_dir / "__init__.py"
    if not init_file.exists():
        init_file.write_text("")

    # Create sample custom.py
    sample_file = routers_dir / "custom.py"
    sample_code = """\
        from fastapi import APIRouter


        router = APIRouter()


        @router.get("/hello")
        async def hello():
            return {"message": "Hello from custom router!"}
    """

    if sample_file.exists():
        tracker.mark_skipped("custom.py")
    else:
        sample_file.write_text(dedent(sample_code))
        tracker.mark_created("custom.py")

    tracker.print_summary("Router setup")


def add_model_user_command():
    """Add user model to project for customization"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    # Create models directory
    models_dir = project_path / "models"
    models_dir.mkdir(exist_ok=True)

    # Create __init__.py
    init_file = models_dir / "__init__.py"
    if not init_file.exists():
        init_file.write_text("from .user import User\n")

    # Copy user.py from package
    source_file = PACKAGE_DIR / "models" / "user.py"
    dest_file = models_dir / "user.py"
    copy_file_if_not_exists(source_file, dest_file, tracker, "user.py")

    tracker.print_summary("User model setup")


def add_auth_custom_command():
    """Add custom auth provider to project for customization"""
    import json

    from dotenv import dotenv_values, set_key

    project_path = validate_project_directory()
    tracker = FileTracker()

    # Create auth/custom directories
    auth_dir = project_path / "auth"
    custom_dir = auth_dir / "custom"
    custom_dir.mkdir(parents=True, exist_ok=True)

    # Create __init__.py files
    auth_init = auth_dir / "__init__.py"
    if not auth_init.exists():
        auth_init.write_text("")

    # Copy custom auth __init__.py from package
    source_file = PACKAGE_DIR / "auth" / "custom" / "__init__.py"
    dest_file = custom_dir / "__init__.py"
    copy_file_if_not_exists(source_file, dest_file, tracker, "auth/custom/__init__.py")

    # Create static/js/auth.js for custom auth
    static_js_dir = project_path / "static" / "js"
    static_js_dir.mkdir(parents=True, exist_ok=True)

    auth_js_dest = static_js_dir / "auth.js"
    auth_js_content = """\
        globalThis.getAuth = async function () {
          return {
            token: "",
            provider: "custom",
          };
        };
    """

    if auth_js_dest.exists():
        tracker.mark_skipped("static/js/auth.js")
    else:
        auth_js_dest.write_text(dedent(auth_js_content))
        tracker.mark_created("static/js/auth.js")

    # Update .env to add "custom" to XLWINGS_AUTH_PROVIDERS
    env_file = project_path / ".env"
    if env_file.exists():
        # Load current values
        env_values = dotenv_values(env_file)
        current_providers = env_values.get("XLWINGS_AUTH_PROVIDERS", "")

        # Parse as JSON array (e.g., ["entraid"])
        if current_providers:
            try:
                providers = json.loads(current_providers)
            except json.JSONDecodeError:
                # Fallback to comma-separated if not JSON
                providers = [p.strip() for p in current_providers.split(",")]
        else:
            providers = []

        # Add "custom" if not already present
        if "custom" not in providers:
            providers.append("custom")
            set_key(
                env_file,
                "XLWINGS_AUTH_PROVIDERS",
                json.dumps(providers),
                quote_mode="never",
            )
            tracker.mark_created(".env (updated XLWINGS_AUTH_PROVIDERS)")
        else:
            tracker.mark_skipped(".env (custom already in XLWINGS_AUTH_PROVIDERS)")

    tracker.print_summary("Custom auth provider setup")


def create_manifest_template(project_path: Path):
    """Copy manifest.xml template from package to project for customization"""
    source_file = PACKAGE_DIR / "templates" / "manifest.xml"
    dest_file = project_path / "templates" / "manifest.xml"

    if dest_file.exists():
        return

    # Create templates directory if it doesn't exist
    dest_file.parent.mkdir(parents=True, exist_ok=True)

    # Copy manifest template
    if source_file.exists():
        shutil.copy(source_file, dest_file)


def create_ribbon_icons(project_path: Path):
    """Copy default ribbon icons from package to project for customization"""
    # Source and destination paths
    source_dir = PACKAGE_DIR / "static" / "images" / "ribbon"
    dest_dir = project_path / "static" / "images" / "ribbon"

    # Icon files to copy
    icon_files = [
        "xlwings-16.png",
        "xlwings-32.png",
        "xlwings-64.png",
        "xlwings-80.png",
    ]

    # Check if icons already exist (idempotency)
    if dest_dir.exists() and all((dest_dir / icon).exists() for icon in icon_files):
        return

    # Create destination directory
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Copy each icon file
    for icon_file in icon_files:
        source_file = source_dir / icon_file
        dest_file = dest_dir / icon_file
        if source_file.exists() and not dest_file.exists():
            shutil.copy(source_file, dest_file)


def create_static_assets(project_path: Path):
    """Copy static CSS and JS files from package to project for customization"""
    # Files to copy
    static_files = [
        ("css", "style.css"),
        ("js", "main.js"),
    ]

    for folder, filename in static_files:
        source_file = PACKAGE_DIR / "static" / folder / filename
        dest_file = project_path / "static" / folder / filename

        if dest_file.exists():
            continue

        # Create directory if needed
        dest_file.parent.mkdir(parents=True, exist_ok=True)

        # Copy file
        if source_file.exists():
            shutil.copy(source_file, dest_file)


def create_dotenv(project_path: Path):
    """Copy .env.template from package to project as .env and set project name and secret key"""
    import secrets

    env_template_path = PACKAGE_DIR / ".env.template"
    env_path = project_path / ".env"

    if env_path.exists():
        return

    # Copy template
    shutil.copy(env_template_path, env_path)

    # Generate secret key
    secret_key = secrets.token_urlsafe(32)
    project_name = project_path.name

    # Read the .env file
    env_content = env_path.read_text()

    # Uncomment and set XLWINGS_PROJECT_NAME
    env_content = env_content.replace(
        '# XLWINGS_PROJECT_NAME=""', f'XLWINGS_PROJECT_NAME="{project_name}"'
    )

    # Uncomment and set XLWINGS_SECRET_KEY
    env_content = env_content.replace(
        'XLWINGS_SECRET_KEY=""', f'XLWINGS_SECRET_KEY="{secret_key}"'
    )

    # Write back
    env_path.write_text(env_content)


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
    """Initialize project"""
    # Determine project path
    if path is None:
        project_path = Path.cwd()

        # Ask for confirmation when initializing in current directory
        print(f"This will initialize an xlwings-server project in: {project_path}")
        response = input("Continue? [y/N]: ").strip().lower()
        if response not in ("y", "yes"):
            print("Initialization cancelled.")
            sys.exit(0)
    else:
        project_path = Path(path).resolve()

    create_project_structure(project_path)
    create_manifest_template(project_path)
    create_ribbon_icons(project_path)
    create_static_assets(project_path)
    create_dotenv(project_path)
    create_uuids(project_path)

    print("Initialization complete!")


def add_azure_functions_command():
    """Add Azure Functions deployment files to project"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    # Azure Functions template files are in xlwings_server/azure_functions_templates/
    source_dir = PACKAGE_DIR / "azure_functions_templates"

    azure_files = [
        "function_app.py",
        "host.json",
        ".funcignore",
        "local.settings.json",
    ]

    # Copy files with idempotency
    for filename in azure_files:
        source_file = source_dir / filename
        dest_file = project_path / filename

        if not source_file.exists():
            print(f"Warning: Source file not found: {source_file}")
            continue

        copy_file_if_not_exists(source_file, dest_file, tracker, filename)

    tracker.print_summary("Azure Functions setup")


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
        help="Initialize project",
    )
    init_parser.add_argument(
        "path",
        nargs="?",
        default=None,
        help="Project path (default: current directory). Use '.' for current directory or specify a path to create a new project.",
    )

    # Add command
    add_parser = subparsers.add_parser("add", help="Add optional components")
    add_subparsers = add_parser.add_subparsers(
        dest="add_category", help="Component categories"
    )

    # azure subcommand (with nested functions subcommand)
    azure_parser = add_subparsers.add_parser("azure", help="Azure integrations")
    azure_subparsers = azure_parser.add_subparsers(
        dest="azure_command", help="Azure services"
    )
    azure_subparsers.add_parser(
        "functions", help="Add Azure Functions deployment files"
    )

    # model subcommand (with nested user subcommand)
    model_parser = add_subparsers.add_parser("model", help="Data models")
    model_subparsers = model_parser.add_subparsers(
        dest="model_command", help="Model types"
    )
    model_subparsers.add_parser("user", help="Add user model for customization")

    # auth subcommand (with nested custom subcommand)
    auth_parser = add_subparsers.add_parser("auth", help="Authentication providers")
    auth_subparsers = auth_parser.add_subparsers(
        dest="auth_command", help="Auth provider types"
    )
    auth_subparsers.add_parser(
        "custom", help="Add custom auth provider for customization"
    )

    # router subcommand (standalone, no nesting needed)
    add_subparsers.add_parser("router", help="Add routers directory and sample router")

    args = parser.parse_args()

    if args.command == "init":
        init_command(args.path)
    elif args.command == "add":
        if args.add_category == "azure":
            if args.azure_command == "functions":
                add_azure_functions_command()
            else:
                print("Error: Please specify Azure service (e.g., functions)")
                sys.exit(1)
        elif args.add_category == "model":
            if args.model_command == "user":
                add_model_user_command()
            else:
                print("Error: Please specify model type (e.g., user)")
                sys.exit(1)
        elif args.add_category == "auth":
            if args.auth_command == "custom":
                add_auth_custom_command()
            else:
                print("Error: Please specify auth provider (e.g., custom)")
                sys.exit(1)
        elif args.add_category == "router":
            add_router_command()
        else:
            print("Error: Please specify what to add")
            print("Available: azure, model, auth, router")
            sys.exit(1)
    else:
        # Default: run server
        run_server()


if __name__ == "__main__":
    main()
