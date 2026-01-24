import argparse
import logging
import os
import shutil
import sys
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from textwrap import dedent
from urllib.parse import urljoin, urlparse

import uvicorn

from xlwings_server.build_utils import StaticFileHasher
from xlwings_server.config import PACKAGE_DIR, PROJECT_DIR


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


def _ignore_dirs(directory: str, files: list[str]) -> set[str]:  # noqa: ARG001
    """Ignore function for shutil.copytree to skip .claude and __pycache__ dirs."""
    return {f for f in files if f in (".claude", "__pycache__")}


def _copy_folder(source_dir: Path, dest_dir: Path, folder_name: str) -> None:
    """Copy folder, replacing destination if it exists."""
    if source_dir.exists():
        if dest_dir.exists():
            shutil.rmtree(dest_dir)
        shutil.copytree(source_dir, dest_dir, ignore=_ignore_dirs)
        print(f"Copied {folder_name}.")
    else:
        print(f"No {folder_name} folder found.")


def _copy_folder_merge(source_dir: Path, dest_dir: Path, folder_name: str) -> None:
    """Copy folder contents, merging with existing files (overwrites on conflict)."""
    if source_dir.exists():
        shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True, ignore=_ignore_dirs)
        print(f"Merged {folder_name}.")


# Migration Helper Functions
def validate_old_project_directory(old_path: Path) -> Path:
    """Validate that old_path contains a valid pre-1.0 project structure"""
    if not old_path.exists():
        print(f"Error: Path does not exist: {old_path}")
        sys.exit(1)

    if not old_path.is_dir():
        print(f"Error: Path is not a directory: {old_path}")
        sys.exit(1)

    # Check for app/ directory
    app_dir = old_path / "app"
    if not app_dir.exists():
        print("Error: Not an old xlwings-server project (no app/ directory found)")
        print(f"Expected to find: {app_dir}")
        sys.exit(1)

    # Check for app/config.py
    config_file = app_dir / "config.py"
    if not config_file.exists():
        print("Error: Not an old xlwings-server project (no app/config.py found)")
        print(f"Expected to find: {config_file}")
        sys.exit(1)

    # Check for app/custom_functions and app/custom_scripts
    if not (app_dir / "custom_functions").exists():
        print("Error: app/custom_functions/ directory not found")
        sys.exit(1)

    if not (app_dir / "custom_scripts").exists():
        print("Error: app/custom_scripts/ directory not found")
        sys.exit(1)

    return old_path


def extract_uuids_from_old_config(config_path: Path) -> dict[str, str]:
    """Extract manifest UUIDs from app/config.py using regex"""
    import re

    content = config_path.read_text()
    uuids = {}

    # Pattern matches both styles:
    # manifest_id_dev = "uuid-here"
    # manifest_id_dev: UUID4 = "uuid-here"
    pattern = r'manifest_id_(\w+)\s*[:=]\s*(?:UUID4\s*=\s*)?["\']([0-9a-f\-]{36})["\']'

    for match in re.finditer(pattern, content, re.MULTILINE):
        env_name, uuid_val = match.groups()
        uuids[f"manifest_id_{env_name}"] = uuid_val

    return uuids


def update_uuids_in_pyproject(uuids: dict[str, str]):
    """Update pyproject.toml with extracted UUIDs using tomlkit"""
    import tomlkit

    pyproject_path = Path("pyproject.toml")

    if not pyproject_path.exists():
        print("Error: pyproject.toml not found in current directory")
        sys.exit(1)

    content = tomlkit.parse(pyproject_path.read_text())

    # Ensure [tool.xlwings_server] section exists
    if "tool" not in content:
        content["tool"] = {}
    if "xlwings_server" not in content["tool"]:
        content["tool"]["xlwings_server"] = {}

    # Update UUIDs
    for key, value in uuids.items():
        content["tool"]["xlwings_server"][key] = value

    pyproject_path.write_text(tomlkit.dumps(content))


def is_file_customized(file_path: Path) -> bool:
    """Check if file exists and is not empty"""
    if not file_path.exists():
        return False

    # Check if file has content (not just whitespace)
    content = file_path.read_text().strip()
    return len(content) > 0


def copy_directory_recursive(
    source: Path,
    dest: Path,
    tracker: FileTracker,
    exclude_patterns: list[str] | None = None,
):
    """Recursively copy directory contents, tracking all files"""
    import shutil

    if not source.exists():
        return

    exclude_patterns = exclude_patterns or []

    for item in source.rglob("*"):
        if item.is_file():
            # Check if file matches any exclude pattern
            relative_path = item.relative_to(source)
            should_exclude = any(
                pattern in str(relative_path) for pattern in exclude_patterns
            )

            if should_exclude:
                continue

            dest_file = dest / relative_path

            # Create parent directories
            dest_file.parent.mkdir(parents=True, exist_ok=True)

            # Copy file
            shutil.copy2(item, dest_file)
            tracker.mark_created(str(dest / relative_path))


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
        from fastapi import APIRouter, Request

        from xlwings_server import settings
        from xlwings_server.templates import TemplateResponse

        router = APIRouter(prefix=settings.app_path)


        @router.get("/hello-json")
        async def hello_json():
            return {"message": "Hello from custom router!"}


        @router.get("/hello-template")
        async def hello_template(request: Request):
            return TemplateResponse(
                request=request,
                name="examples/hello_world/taskpane_hello.html",
            )

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
            token: "test-token",  // TODO: implement
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
        env_content = env_file.read_text()

        # Check if XLWINGS_AUTH_PROVIDERS is commented
        if "# XLWINGS_AUTH_PROVIDERS=[]" in env_content:
            # Uncomment and set to ["custom"]
            env_content = env_content.replace(
                "# XLWINGS_AUTH_PROVIDERS=[]", 'XLWINGS_AUTH_PROVIDERS=["custom"]'
            )
            env_file.write_text(env_content)
            tracker.mark_created(".env (updated XLWINGS_AUTH_PROVIDERS)")
        elif "XLWINGS_AUTH_PROVIDERS=" in env_content:
            # Line is already uncommented, parse and update
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
        else:
            tracker.mark_skipped(".env (XLWINGS_AUTH_PROVIDERS not found)")

    tracker.print_summary("Custom auth provider setup")


def add_config_command():
    """Add config.py to project for customizing settings"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    # Check if config.py already exists
    config_file = project_path / "config.py"
    if config_file.exists():
        tracker.mark_skipped("config.py (already exists)")
    else:
        # Create config.py template
        template = dedent('''\
            """This uses pydantic-settings:
            https://docs.pydantic.dev/latest/concepts/pydantic_settings/
            """

            from xlwings_server.config import Settings as BaseSettings


            class Settings(BaseSettings):
                my_custom_setting: str = "default_value"

        ''')

        config_file.write_text(template)
        tracker.mark_created("config.py")

    tracker.print_summary("Config setup")


def add_auth_entraid_command():
    """Add Entra ID auth provider jwks.py to project for customization"""
    import json

    from dotenv import dotenv_values, set_key

    project_path = validate_project_directory()
    tracker = FileTracker()

    # Create auth/entraid directories
    auth_dir = project_path / "auth"
    entraid_dir = auth_dir / "entraid"
    entraid_dir.mkdir(parents=True, exist_ok=True)

    # Create __init__.py files
    auth_init = auth_dir / "__init__.py"
    if not auth_init.exists():
        auth_init.write_text("")

    # Copy jwks.py from package
    source_file = PACKAGE_DIR / "auth" / "entraid" / "jwks.py"
    dest_file = entraid_dir / "jwks.py"
    copy_file_if_not_exists(source_file, dest_file, tracker, "auth/entraid/jwks.py")

    # Update .env to add "entraid" to XLWINGS_AUTH_PROVIDERS
    env_file = project_path / ".env"
    if env_file.exists():
        env_content = env_file.read_text()

        # Check if XLWINGS_AUTH_PROVIDERS is commented
        if "# XLWINGS_AUTH_PROVIDERS=[]" in env_content:
            # Uncomment and set to ["entraid"]
            env_content = env_content.replace(
                "# XLWINGS_AUTH_PROVIDERS=[]", 'XLWINGS_AUTH_PROVIDERS=["entraid"]'
            )
            env_file.write_text(env_content)
            tracker.mark_created(".env (updated XLWINGS_AUTH_PROVIDERS)")
        elif "XLWINGS_AUTH_PROVIDERS=" in env_content:
            # Line is already uncommented, parse and update
            env_values = dotenv_values(env_file)
            current_providers = env_values.get("XLWINGS_AUTH_PROVIDERS", "")

            # Parse as JSON array (e.g., ["custom"])
            if current_providers:
                try:
                    providers = json.loads(current_providers)
                except json.JSONDecodeError:
                    # Fallback to comma-separated if not JSON
                    providers = [p.strip() for p in current_providers.split(",")]
            else:
                providers = []

            # Add "entraid" if not already present
            if "entraid" not in providers:
                providers.append("entraid")
                set_key(
                    env_file,
                    "XLWINGS_AUTH_PROVIDERS",
                    json.dumps(providers),
                    quote_mode="never",
                )
                tracker.mark_created(".env (updated XLWINGS_AUTH_PROVIDERS)")
            else:
                tracker.mark_skipped(".env (entraid already in XLWINGS_AUTH_PROVIDERS)")
        else:
            tracker.mark_skipped(".env (XLWINGS_AUTH_PROVIDERS not found)")

    tracker.print_summary("Entra ID auth provider setup")


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


def add_css_command(silent: bool = False):
    """Add style.css to project for customization"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    source_file = PACKAGE_DIR / "static" / "css" / "style.css"
    dest_file = project_path / "static" / "css" / "style.css"

    copy_file_if_not_exists(source_file, dest_file, tracker, "static/css/style.css")
    if not silent:
        tracker.print_summary("CSS setup")


def add_js_command(silent: bool = False):
    """Add main.js to project for customization"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    source_file = PACKAGE_DIR / "static" / "js" / "main.js"
    dest_file = project_path / "static" / "js" / "main.js"

    copy_file_if_not_exists(source_file, dest_file, tracker, "static/js/main.js")
    if not silent:
        tracker.print_summary("JS setup")


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


def create_gitignore(project_path: Path):
    """Create or update .gitignore with xlwings-server specific entries"""
    gitignore_path = project_path / ".gitignore"

    # xlwings-server specific entries
    xlwings_entries = [
        "",
        "# xlwings-server",
        ".env",
        "certs/",
        "*.pem",
    ]

    # Base Python entries (only used if .gitignore doesn't exist)
    base_entries = [
        "# Python-generated files",
        "__pycache__/",
        "*.py[oc]",
        "build/",
        "dist/",
        "wheels/",
        "*.egg-info",
        "",
        "# Virtual environments",
        ".venv",
    ]

    if gitignore_path.exists():
        # .gitignore exists - append only xlwings-server entries if not present
        content = gitignore_path.read_text()

        # Check if xlwings entries are already present
        has_xlwings_section = "# xlwings-server" in content

        if not has_xlwings_section:
            # Ensure file ends with newline before appending
            if content and not content.endswith("\n"):
                content += "\n"

            # Append xlwings-server specific entries
            content += "\n".join(xlwings_entries) + "\n"
            gitignore_path.write_text(content)
    else:
        # .gitignore doesn't exist - create with base + xlwings entries
        all_entries = base_entries + xlwings_entries
        gitignore_path.write_text("\n".join(all_entries) + "\n")


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
    create_dotenv(project_path)
    create_gitignore(project_path)
    create_uuids(project_path)

    # Add CSS and JS files (reusing existing commands)
    original_cwd = Path.cwd()
    try:
        os.chdir(project_path)

        # Create empty images directory
        images_dir = project_path / "static" / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        # Add CSS and JS (silent mode to avoid cluttering init output)
        add_css_command(silent=True)
        add_js_command(silent=True)
    finally:
        os.chdir(original_cwd)

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


def add_docker_command():
    """Add Docker deployment files to project"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    source_dir = PACKAGE_DIR / "docker_templates"

    docker_files = [
        "Dockerfile",
        "docker-compose.yaml",
        ".dockerignore",
    ]

    for filename in docker_files:
        source_file = source_dir / filename
        dest_file = project_path / filename

        if not source_file.exists():
            print(f"Warning: Source file not found: {source_file}")
            continue

        copy_file_if_not_exists(source_file, dest_file, tracker, filename)

    tracker.print_summary("Docker setup")


def migrate_command(old_project_path: str):
    """Migrate from pre-1.0 project structure to new 1.0+ structure"""
    import shutil

    # Phase 1: Validation
    print("Starting migration...")

    # Validate current directory is a new project
    validate_project_directory()

    # Check for pyproject.toml
    if not Path("pyproject.toml").exists():
        print("Error: pyproject.toml not found in current directory")
        print("Run this command from an initialized xlwings-server 1.0+ project")
        sys.exit(1)

    # Validate old project structure
    old_path = validate_old_project_directory(Path(old_project_path))

    tracker = FileTracker()

    # Phase 2: Core File Migration
    # Remove default templates (from init) and old examples (from pre-1.0)
    files_to_remove = [
        Path("custom_functions/functions.py"),  # Default from xlwings-server init
        Path("custom_scripts/scripts.py"),  # Default from xlwings-server init
        Path("main.py"),  # Default from uv init
        Path("README.md"),  # Default from uv init
    ]
    for file_path in files_to_remove:
        if file_path.exists():
            file_path.unlink()

    # 1. Custom functions & scripts
    app_path = old_path / "app"
    copy_directory_recursive(
        app_path / "custom_functions",
        Path("custom_functions"),
        tracker,
        exclude_patterns=["__pycache__", "examples.py"],
    )
    copy_directory_recursive(
        app_path / "custom_scripts",
        Path("custom_scripts"),
        tracker,
        exclude_patterns=["__pycache__", "examples.py"],
    )

    # Clean up __init__.py files - only keep lines with "import *"
    for init_file in [
        Path("custom_functions/__init__.py"),
        Path("custom_scripts/__init__.py"),
    ]:
        if init_file.exists():
            content = init_file.read_text()
            lines = content.splitlines(keepends=True)

            # Only keep lines that contain "import *" (but not .examples)
            cleaned_lines = []
            for line in lines:
                # Keep only import * lines (excluding .examples imports)
                if "import *" in line and ".examples" not in line:
                    cleaned_lines.append(line)

            # Write cleaned content
            init_file.write_text("".join(cleaned_lines))

    # 2. Certificates
    old_certs = old_path / "certs"
    if old_certs.exists():
        copy_directory_recursive(old_certs, Path("certs"), tracker)

    # 3. .env file
    old_env = old_path / ".env"
    if old_env.exists():
        shutil.copy2(old_env, ".env")
        tracker.mark_created(".env")

    # 4. Templates - Manifest and Taskpane
    Path("templates").mkdir(exist_ok=True)

    # Copy manifest.xml as-is
    old_manifest = app_path / "templates" / "manifest.xml"
    if old_manifest.exists():
        shutil.copy2(old_manifest, "templates/manifest.xml")
        tracker.mark_created("templates/manifest.xml")

    # Determine which taskpane template was used in old project
    old_taskpane_router = app_path / "routers" / "taskpane.py"
    taskpane_template_name = None

    if old_taskpane_router.exists():
        # Parse the router to find the template name
        router_content = old_taskpane_router.read_text()

        # Look for template name when enable_examples is False
        import re

        # First check if there's conditional logic based on enable_examples
        if "enable_examples" in router_content:
            # Parse conditional: if not settings.enable_examples: name="..."
            match = re.search(
                r'if\s+not\s+settings\.enable_examples.*?name\s*=\s*["\']([^"\']+)["\']',
                router_content,
                re.DOTALL,
            )
            if match:
                taskpane_template_name = match.group(1)

        # If no conditional found, look for direct template name
        if not taskpane_template_name:
            # Look for: name="..." or name='...'
            match = re.search(r'name\s*=\s*["\']([^"\']+)["\']', router_content)
            if match:
                taskpane_template_name = match.group(1)
            else:
                # Look for: name=settings.something
                match = re.search(r"name\s*=\s*settings\.(\w+)", router_content)
                if match:
                    taskpane_template_name = "taskpane.html"  # Default fallback

    # Copy the identified taskpane template
    if taskpane_template_name:
        old_taskpane_template = app_path / "templates" / taskpane_template_name
        if old_taskpane_template.exists():
            shutil.copy2(old_taskpane_template, "templates/taskpane.html")
            tracker.mark_created(
                f"templates/taskpane.html (from {taskpane_template_name})"
            )
        else:
            # Template doesn't exist, try direct copy
            direct_taskpane = app_path / "templates" / "taskpane.html"
            if direct_taskpane.exists():
                shutil.copy2(direct_taskpane, "templates/taskpane.html")
                tracker.mark_created("templates/taskpane.html")
    else:
        # No router found, copy taskpane.html if it exists
        direct_taskpane = app_path / "templates" / "taskpane.html"
        if direct_taskpane.exists():
            shutil.copy2(direct_taskpane, "templates/taskpane.html")
            tracker.mark_created("templates/taskpane.html")

    # 5. Extract and update UUIDs
    uuids = extract_uuids_from_old_config(app_path / "config.py")
    if uuids:
        update_uuids_in_pyproject(uuids)
        tracker.mark_created("pyproject.toml (UUIDs updated)")

    # Phase 3: Optional Components Detection & Migration
    # Static files - CSS
    old_css = app_path / "static" / "css" / "style.css"
    if is_file_customized(old_css):
        Path("static/css").mkdir(parents=True, exist_ok=True)
        shutil.copy2(old_css, "static/css/style.css")
        tracker.mark_created("static/css/style.css")

    # Static files - JS
    old_js = app_path / "static" / "js" / "main.js"
    if is_file_customized(old_js):
        Path("static/js").mkdir(parents=True, exist_ok=True)
        shutil.copy2(old_js, "static/js/main.js")
        tracker.mark_created("static/js/main.js")

    # Static files - ribbon.js
    old_ribbon_js = app_path / "static" / "js" / "ribbon.js"
    if is_file_customized(old_ribbon_js):
        Path("static/js").mkdir(parents=True, exist_ok=True)
        shutil.copy2(old_ribbon_js, "static/js/ribbon.js")
        tracker.mark_created("static/js/ribbon.js")

    # Static files - Images
    old_images = app_path / "static" / "images"
    if old_images.exists() and any(old_images.iterdir()):
        copy_directory_recursive(old_images, Path("static/images"), tracker)

    # Static files - Other static content
    old_static = app_path / "static"
    if old_static.exists():
        for item in old_static.iterdir():
            # Skip already handled directories
            if item.name in ["css", "js", "images", "vendor"]:
                continue
            if item.is_dir():
                copy_directory_recursive(item, Path("static") / item.name, tracker)
            elif item.is_file():
                Path("static").mkdir(exist_ok=True)
                shutil.copy2(item, Path("static") / item.name)
                tracker.mark_created(f"static/{item.name}")

    # Custom templates (excluding package templates and already-handled files)
    old_templates = app_path / "templates"
    # These are package templates that should not be migrated
    excluded_templates = {
        "manifest.xml",  # Already handled specially
        "taskpane.html",  # Already handled specially
        "_book.html",  # Package template
        "alert_base.html",  # Package template
        "base.html",  # Package template
        "xlwings_alert.html",  # Package template
        "examples",  # Package examples directory
    }

    if old_templates.exists():
        for item in old_templates.iterdir():
            if item.name in excluded_templates:
                continue
            if item.is_file():
                dest_file = Path("templates") / item.name
                shutil.copy2(item, dest_file)
                tracker.mark_created(f"templates/{item.name}")
            elif item.is_dir():
                copy_directory_recursive(item, Path("templates") / item.name, tracker)

    # Parse and install dependencies from old requirements.in
    old_requirements_in = old_path / "requirements.in"
    if old_requirements_in.exists():
        print("\nInstalling dependencies from requirements.in...")
        requirements_content = old_requirements_in.read_text()

        # Parse dependencies (skip comments and -r references)
        dependencies = []
        for line in requirements_content.splitlines():
            line = line.strip()
            # Skip empty lines, comments, and -r references
            if not line or line.startswith("#") or line.startswith("-r"):
                continue
            dependencies.append(line)

        # Install dependencies using uv add
        if dependencies:
            import subprocess

            try:
                cmd = ["uv", "add"] + dependencies
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                print(f"Successfully added: {', '.join(dependencies)}")
                tracker.mark_created(f"Dependencies: {', '.join(dependencies)}")
            except subprocess.CalledProcessError as e:
                print(f"Warning: Failed to install some dependencies: {e}")
                print(
                    f"You can manually install them with: uv add {' '.join(dependencies)}"
                )
            except FileNotFoundError:
                print("Warning: 'uv' command not found.")
                print(
                    f"Please manually install dependencies: uv add {' '.join(dependencies)}"
                )

    # Phase 4: Report
    tracker.print_summary("Migration")


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

    # Copy over required settings to wasm .env
    # This is done before starting the server to ensure wasm has up-to-date settings
    from xlwings_server.config import settings  # noqa: E402

    wasm_dir = project_dir / "wasm"
    if settings.enable_wasm and wasm_dir.exists():
        env_file = wasm_dir / ".env"
        create_wasm_settings(settings, env_file)

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


def create_wasm_settings(settings, env_file):
    settings_map = {
        "XLWINGS_LICENSE_KEY": f'"{settings.license_key}"',
        "XLWINGS_ENABLE_EXAMPLES": str(settings.enable_examples).lower(),
        "XLWINGS_ENVIRONMENT": settings.environment,
        "XLWINGS_ENABLE_TESTS": str(settings.enable_tests).lower(),
        "XLWINGS_FUNCTIONS_NAMESPACE": settings.functions_namespace,
        "XLWINGS_IS_OFFICIAL_LITE_ADDIN": str(settings.is_official_lite_addin).lower(),
    }

    for key, value in settings_map.items():
        update_wasm_settings(key, value, env_file)


def update_wasm_settings(key: str, value: str, env_file: Path):
    if env_file.exists():
        content = env_file.read_text().splitlines()
    else:
        content = []

    key_found = False
    for i, line in enumerate(content):
        if line.startswith(f"{key}="):
            content[i] = f"{key}={value}"
            key_found = True
            break

    if not key_found:
        content.append(f"{key}={value}")

    env_file.parent.mkdir(parents=True, exist_ok=True)
    env_file.write_text("\n".join(content) + "\n")


def build_static_command(output_dir: str = "./dist", clean: bool = False):
    """Build static files and templates for production deployment with hashed filenames."""
    project_path = validate_project_directory()
    output_path = Path(output_dir)

    if clean and output_path.exists():
        shutil.rmtree(output_path)
        print("Output directory cleaned.")

    output_path.mkdir(exist_ok=True)

    # Copy static: package first, then project overlays
    _copy_folder(PACKAGE_DIR / "static", output_path / "static", "static (package)")
    _copy_folder_merge(
        project_path / "static", output_path / "static", "static (project)"
    )

    # Copy templates: package first, then project overlays
    _copy_folder(
        PACKAGE_DIR / "templates", output_path / "templates", "templates (package)"
    )
    _copy_folder_merge(
        project_path / "templates", output_path / "templates", "templates (project)"
    )

    # Hash static files and update references in templates
    hasher = StaticFileHasher(
        static_dir=output_path / "static", templates_dir=output_path / "templates"
    )
    hasher.process_files()

    print(f"\nBuild complete: {output_path.resolve()}")


def build_wasm_command(
    url, output_dir, create_zip=False, clean=False, environment=None
):
    import xlwings
    import xlwings as xw

    logging.getLogger("httpx").setLevel(logging.WARNING)
    build_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Settings overrides
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    app_path = parsed.path.rstrip("/")

    # TODO: these env vars aren't respected anymore, probably because of the config
    # import at the top. Need to be set directly in the environment where this is
    # running, e.g., CI
    os.environ["XLWINGS_ENABLE_WASM"] = "true"
    os.environ["XLWINGS_ENABLE_SOCKETIO"] = "false"
    os.environ["XLWINGS_APP_PATH"] = app_path
    os.environ["XLWINGS_STATIC_URL_PATH"] = f"{app_path}/static"

    if environment:
        os.environ["XLWINGS_ENVIRONMENT"] = environment

    from fastapi.testclient import TestClient  # noqa: E402

    from xlwings_server.config import settings  # noqa: E402
    from xlwings_server.main import main_app  # noqa: E402

    # Make sure settings is up-to-date
    create_wasm_settings(settings=settings, env_file=PROJECT_DIR / "wasm" / ".env")

    # Take the license key from .env
    os.environ["XLWINGS_LICENSE_KEY"] = settings.license_key
    import xlwings.pro

    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)

    # Clean output directory
    if clean:
        if output_dir.exists():
            for filename in os.listdir(output_dir):
                file_path = output_dir / filename
                if file_path.is_file():
                    file_path.unlink()
                elif file_path.is_dir():
                    shutil.rmtree(file_path)
            print("Output directory cleaned.")

    # Endpoints
    client = TestClient(main_app)

    route_paths = [
        "manifest.xml",
        "taskpane.html",  # TODO: cover all routes from taskpane.py
        "xlwings/custom-functions-meta.json",
        "xlwings/custom-functions-code.js",
        "xlwings/pyodide.json",
    ]

    base_path = f"{app_path}/" if app_path else "/"
    routes = [urljoin(base_path, path) for path in route_paths]

    for ix, route in enumerate(routes):
        response = client.get(route)
        if response.status_code == 200:
            content = response.text
            filename = Path(route_paths[ix])
            if filename.name == "manifest.xml":
                content = content.replace("http://testserver", base_url)

            file_path = output_dir / filename
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content)
        else:
            print(f"Failed to fetch {route} (status code: {response.status_code})")

    # Index.html
    index_path = output_dir / "index.html"
    index_path.write_text(f"This is an xlwings Wasm app! ({build_timestamp})")

    print("Static site generation complete.")

    # Copy from PACKAGE_DIR first (base files)
    _copy_folder(PACKAGE_DIR / "static", output_dir / "static", "static (package)")
    _copy_folder(PACKAGE_DIR / "wasm", output_dir / "wasm", "wasm (package)")
    _copy_folder(
        PACKAGE_DIR / "custom_functions",
        output_dir / "custom_functions",
        "custom_functions (package)",
    )
    _copy_folder(
        PACKAGE_DIR / "custom_scripts",
        output_dir / "custom_scripts",
        "custom_scripts (package)",
    )

    # Copy from PROJECT_DIR to overwrite with user customizations
    _copy_folder_merge(
        PROJECT_DIR / "static", output_dir / "static", "static (project)"
    )
    _copy_folder_merge(PROJECT_DIR / "wasm", output_dir / "wasm", "wasm (project)")
    _copy_folder_merge(
        PROJECT_DIR / "custom_functions",
        output_dir / "custom_functions",
        "custom_functions (project)",
    )
    _copy_folder_merge(
        PROJECT_DIR / "custom_scripts",
        output_dir / "custom_scripts",
        "custom_scripts (project)",
    )

    # .env
    try:
        deploy_key = xlwings.pro.LicenseHandler.create_deploy_key()
    except xw.LicenseError:
        deploy_key = settings.license_key
    update_wasm_settings(
        "XLWINGS_LICENSE_KEY", deploy_key, output_dir / "wasm" / ".env"
    )
    if environment:
        update_wasm_settings(
            "XLWINGS_ENVIRONMENT", environment, output_dir / "wasm" / ".env"
        )

    # Remove unused libraries
    def remove_dir_if_exists(path: Path) -> None:
        if path.exists():
            shutil.rmtree(path)

    remove_dir_if_exists(output_dir / "static" / "vendor" / "socket.io")
    if not settings.enable_alpinejs_csp:
        remove_dir_if_exists(output_dir / "static" / "vendor" / "@alpinejs")
    if settings.cdn_officejs:
        remove_dir_if_exists(output_dir / "static" / "vendor" / "@microsoft")
    if not settings.enable_bootstrap:
        remove_dir_if_exists(output_dir / "static" / "vendor" / "bootstrap")
        remove_dir_if_exists(output_dir / "static" / "vendor" / "bootstrap-xlwings")
    if not settings.enable_htmx:
        remove_dir_if_exists(output_dir / "static" / "vendor" / "htmx-ext-head-support")
        remove_dir_if_exists(
            output_dir / "static" / "vendor" / "htmx-ext-loading-states"
        )
        remove_dir_if_exists(output_dir / "static" / "vendor" / "htmx.org")

    def has_pyodide_requirement(requirements_file):
        if not requirements_file.exists():
            return False
        with open(requirements_file, "r") as f:
            return any("/static/vendor/pyodide/" in line for line in f)

    if settings.cdn_pyodide:
        requirements_path = output_dir / "wasm" / "requirements.txt"
        if not has_pyodide_requirement(requirements_path):
            remove_dir_if_exists(output_dir / "static" / "vendor" / "pyodide")

    # Remove unwanted files
    for cache_dir in (output_dir / "wasm").rglob("__pycache__"):
        remove_dir_if_exists(cache_dir)

    for ds_store in output_dir.rglob(".DS_Store"):
        ds_store.unlink(missing_ok=True)

    # Hash files
    hasher = StaticFileHasher(static_dir=output_dir, templates_dir=output_dir)
    hasher.process_files()

    # ZIP file
    if create_zip:
        zip_filename = output_dir / f"xlwings_wasm_{build_timestamp}.zip"

        try:
            with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file_path in output_dir.rglob("*"):
                    if file_path.is_file() and file_path != zip_filename:
                        arcname = file_path.relative_to(output_dir)
                        zipf.write(file_path, arcname)
            print(f"Created zip file: {zip_filename}")
        except Exception as e:
            print(f"Error creating zip file: {e}")


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

    # auth subcommand (with nested custom and entraid subcommands)
    auth_parser = add_subparsers.add_parser("auth", help="Authentication providers")
    auth_subparsers = auth_parser.add_subparsers(
        dest="auth_command", help="Auth provider types"
    )
    auth_subparsers.add_parser(
        "custom", help="Add custom auth provider for customization"
    )
    auth_subparsers.add_parser(
        "entraid", help="Add Entra ID auth provider jwks.py for customization"
    )

    # docker subcommand (standalone)
    add_subparsers.add_parser("docker", help="Add Docker deployment files")

    # router subcommand (standalone, no nesting needed)
    add_subparsers.add_parser("router", help="Add routers directory and sample router")

    # css subcommand (standalone)
    add_subparsers.add_parser("css", help="Add style.css for customization")

    # js subcommand (standalone)
    add_subparsers.add_parser("js", help="Add main.js for customization")

    # config subcommand (standalone)
    add_subparsers.add_parser("config", help="Add config.py for extending settings")

    # Build command with subcommands
    build_parser = subparsers.add_parser("build", help="Build commands for deployment")
    build_subparsers = build_parser.add_subparsers(
        dest="build_command", help="Build targets"
    )

    # build static subcommand
    build_static_parser = build_subparsers.add_parser(
        "static", help="Build static files and templates with hashed filenames"
    )
    build_static_parser.add_argument(
        "-o",
        "--output-dir",
        help="Output directory path (default: ./dist)",
        type=str,
        default="./dist",
    )
    build_static_parser.add_argument(
        "--no-clean",
        help="Don't clean the output directory before building",
        action="store_true",
    )

    # build wasm subcommand
    build_wasm_parser = build_subparsers.add_parser(
        "wasm", help="Build xlwings Wasm distribution"
    )
    build_wasm_parser.add_argument(
        "url", help="URL of where the xlwings Wasm app will be hosted"
    )
    build_wasm_parser.add_argument(
        "-o",
        "--output-dir",
        help="Output directory path (default: ./dist)",
        type=str,
        default="./dist",
    )
    build_wasm_parser.add_argument(
        "-z",
        "--create-zip",
        help="Create zip archive in addition to the static files",
        action="store_true",
    )
    build_wasm_parser.add_argument(
        "--no-clean",
        help="Don't clean the output directory before building",
        action="store_true",
    )
    build_wasm_parser.add_argument(
        "-e",
        "--environment",
        help="Sets XLWINGS_ENVIRONMENT (default: value from .env)",
        type=str,
    )

    # Migrate command
    migrate_parser = subparsers.add_parser(
        "migrate", help="Migrate from pre-1.0 project structure"
    )
    migrate_parser.add_argument(
        "old_project_path",
        help="Path to old xlwings-server project (directory containing app/)",
    )

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
            elif args.auth_command == "entraid":
                add_auth_entraid_command()
            else:
                print("Error: Please specify auth provider (e.g., custom, entraid)")
                sys.exit(1)
        elif args.add_category == "docker":
            add_docker_command()
        elif args.add_category == "router":
            add_router_command()
        elif args.add_category == "css":
            add_css_command()
        elif args.add_category == "js":
            add_js_command()
        elif args.add_category == "config":
            add_config_command()
        else:
            print("Error: Please specify what to add")
            print("Available: azure, docker, model, auth, router, css, js, config")
            sys.exit(1)
    elif args.command == "build":
        if args.build_command == "static":
            build_static_command(output_dir=args.output_dir, clean=not args.no_clean)
        elif args.build_command == "wasm":
            build_wasm_command(
                url=args.url,
                output_dir=args.output_dir,
                create_zip=args.create_zip,
                clean=not args.no_clean,
                environment=args.environment,
            )
        else:
            print("Error: Please specify build target (e.g., static, wasm)")
            sys.exit(1)
    elif args.command == "migrate":
        migrate_command(args.old_project_path)
    else:
        # Default: run server
        run_server()


if __name__ == "__main__":
    main()
