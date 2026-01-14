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


def add_css_command():
    """Add style.css to project for customization"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    source_file = PACKAGE_DIR / "static" / "css" / "style.css"
    dest_file = project_path / "static" / "css" / "style.css"

    copy_file_if_not_exists(source_file, dest_file, tracker, "static/css/style.css")
    tracker.print_summary("CSS setup")


def add_js_command():
    """Add main.js to project for customization"""
    project_path = validate_project_directory()
    tracker = FileTracker()

    source_file = PACKAGE_DIR / "static" / "js" / "main.js"
    dest_file = project_path / "static" / "js" / "main.js"

    copy_file_if_not_exists(source_file, dest_file, tracker, "static/js/main.js")
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
    create_ribbon_icons(project_path)
    create_dotenv(project_path)
    create_gitignore(project_path)
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


def wasm_build(url, output_dir, create_zip=False, clean=False, environment=None):
    import xlwings
    import xlwings as xw

    logging.getLogger("httpx").setLevel(logging.WARNING)
    build_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Settings overrides
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    app_path = parsed.path.rstrip("/")

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
        "xlwings/custom-scripts-sheet-buttons.js",
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

    # Copy folders
    def ignore_local_settings(dir, files: list[str]) -> set[str]:  # noqa: ARG001
        """Ignore function for shutil.copytree to skip settings.local.json and .claude dirs."""
        return {f for f in files if f == ".claude"}

    def copy_folder(source_dir: Path, dest_dir: Path, folder_name: str) -> None:
        if source_dir.exists():
            if dest_dir.exists():
                shutil.rmtree(dest_dir)
            shutil.copytree(source_dir, dest_dir, ignore=ignore_local_settings)
            print(f"{folder_name.capitalize()} folder contents copied.")
        else:
            print(f"No {folder_name} folder found to copy")

    def copy_folder_merge(source_dir: Path, dest_dir: Path, folder_name: str) -> None:
        """Copy folder contents, merging with existing files (overwrites on conflict)."""
        if source_dir.exists():
            shutil.copytree(
                source_dir, dest_dir, dirs_exist_ok=True, ignore=ignore_local_settings
            )
            print(f"{folder_name.capitalize()} folder contents copied.")
        else:
            print(f"No {folder_name} folder found to copy")

    # Copy from PACKAGE_DIR first (base files)
    copy_folder(PACKAGE_DIR / "static", output_dir / "static", "Static")
    copy_folder(PACKAGE_DIR / "wasm", output_dir / "wasm", "wasm")
    copy_folder(
        PACKAGE_DIR / "custom_functions",
        output_dir / "custom_functions",
        "custom_functions",
    )
    copy_folder(
        PACKAGE_DIR / "custom_scripts",
        output_dir / "custom_scripts",
        "custom_scripts",
    )

    # Copy from PROJECT_DIR to overwrite with user customizations
    copy_folder_merge(PROJECT_DIR / "static", output_dir / "static", "Static (project)")
    copy_folder_merge(PROJECT_DIR / "wasm", output_dir / "wasm", "wasm (project)")
    copy_folder_merge(
        PROJECT_DIR / "custom_functions",
        output_dir / "custom_functions",
        "custom_functions (project)",
    )
    copy_folder_merge(
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

    # router subcommand (standalone, no nesting needed)
    add_subparsers.add_parser("router", help="Add routers directory and sample router")

    # css subcommand (standalone)
    add_subparsers.add_parser("css", help="Add style.css for customization")

    # js subcommand (standalone)
    add_subparsers.add_parser("js", help="Add main.js for customization")

    # Wasm command
    wasm_parser = subparsers.add_parser("wasm", help="Build xlwings Wasm distribution")
    wasm_parser.add_argument(
        "url", help="URL of where the xlwings Wasm app will be hosted"
    )
    wasm_parser.add_argument(
        "-o",
        "--output-dir",
        help="Output directory path (default: ./dist)",
        type=str,
        default="./dist",
    )
    wasm_parser.add_argument(
        "-z",
        "--create-zip",
        help="Create zip archive in addition to the static files",
        action="store_true",
    )
    wasm_parser.add_argument(
        "-c",
        "--clean",
        help="Clean the output directory before building",
        action="store_true",
    )
    wasm_parser.add_argument(
        "-e",
        "--environment",
        help="Sets XLWINGS_ENVIRONMENT (default: value from .env)",
        type=str,
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
        elif args.add_category == "router":
            add_router_command()
        elif args.add_category == "css":
            add_css_command()
        elif args.add_category == "js":
            add_js_command()
        else:
            print("Error: Please specify what to add")
            print("Available: azure, model, auth, router, css, js")
            sys.exit(1)
    elif args.command == "wasm":
        wasm_build(
            url=args.url,
            output_dir=args.output_dir,
            create_zip=args.create_zip,
            clean=args.clean,
            environment=args.environment,
        )
    else:
        # Default: run server
        run_server()


if __name__ == "__main__":
    main()
