import argparse
import logging
import os
import re
import shutil
import subprocess
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import uvicorn
import xlwings as xw
from cryptography.fernet import Fernet

is_cloud = os.getenv("CODESPACES") or os.getenv("GITPOD_WORKSPACE_ID")
this_dir = Path(__file__).parent.resolve()


def create_lite_settings(settings, env_file):
    settings_map = {
        "XLWINGS_LICENSE_KEY": f'"{settings.license_key}"',
        "XLWINGS_ENABLE_EXAMPLES": str(settings.enable_examples).lower(),
        "XLWINGS_ENVIRONMENT": settings.environment,
        "XLWINGS_ENABLE_TESTS": str(settings.enable_tests).lower(),
        "XLWINGS_FUNCTIONS_NAMESPACE": settings.functions_namespace,
        "XLWINGS_IS_OFFICIAL_LITE_ADDIN": str(settings.is_official_lite_addin).lower(),
    }

    for key, value in settings_map.items():
        update_lite_settings(key, value, env_file)


def update_lite_settings(key: str, value: str, env_file: Path):
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


def replace_uuids():
    file_path = this_dir / "app" / "config.py"
    with open(file_path, "r") as file:
        lines = file.readlines()

    uuids = [
        "0a856eb1-91ab-4f38-b757-23fbe1f73130",
        "9cda34b1-af68-4dc6-b97c-e63ef6284671",
        "4f342d85-3a49-41cb-90a5-37b1f2219040",
        "34041f4f-9cb4-4830-afb5-db44b2a70e0e",
        "70428e53-8113-421c-8fe2-9b74fcb94ee5",
    ]
    with open(file_path, "w") as file:
        for line in lines:
            if "manifest_id" in line and any(uuid in line for uuid in uuids):
                line = re.sub(
                    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
                    str(uuid.uuid4()),
                    line,
                )
                file.write(line)
            else:
                file.write(line)


def create_dotenv():
    if not (this_dir / ".env").exists():
        shutil.copy(this_dir / ".env.template", this_dir / ".env")
        insert_secret_key()
    else:
        print("Didn't create an '.env' file as one already exists.")


def insert_secret_key():
    secret_key = Fernet.generate_key().decode()
    with open(this_dir / ".env", "r") as file:
        lines = file.readlines()
    with open(this_dir / ".env", "w") as file:
        for line in lines:
            if line.startswith("XLWINGS_SECRET_KEY="):
                file.write(f'XLWINGS_SECRET_KEY="{secret_key}"\n')
            else:
                file.write(line)


def init():
    replace_uuids()
    create_dotenv()
    print("Success! Now open the .env file and add a license key")


def deps_compile(upgrade=False):
    # The order of how these files matters because they are all interdependent
    file_names = ["requirements-core", "requirements", "requirements-dev"]
    for file_name in file_names:
        cmd_linux = f"uv pip compile {file_name}.in --universal -o {file_name}.txt --unsafe-package pywin32 --unsafe-package appscript --unsafe-package psutil {'--upgrade' if upgrade else ''}"
        subprocess.run(cmd_linux, shell=True, check=True)
    print(
        f"Success! Requirements files {'upgraded' if upgrade else 'compiled'} successfully. Now commit the requirements.txt files!"
    )


def lite_build(url, output_dir, create_zip=False, clean=False, environment=None):
    logging.getLogger("httpx").setLevel(logging.WARNING)
    build_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Settings overrides
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    app_path = parsed.path.rstrip("/")

    os.environ["XLWINGS_ENABLE_LITE"] = "true"
    os.environ["XLWINGS_ENABLE_SOCKETIO"] = "false"
    os.environ["XLWINGS_APP_PATH"] = app_path
    os.environ["XLWINGS_STATIC_URL_PATH"] = f"{app_path}/static"

    if environment:
        os.environ["XLWINGS_ENVIRONMENT"] = environment

    from fastapi.testclient import TestClient  # noqa: E402

    from app.config import settings  # noqa: E402
    from app.main import main_app  # noqa: E402

    # Make sure settings is up-to-date
    create_lite_settings(settings=settings, env_file=this_dir / "app" / "lite" / ".env")

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
    index_path.write_text(f"This is an xlwings Lite app! ({build_timestamp})")

    print("Static site generation complete.")

    # Copy folders
    def copy_folder(source_dir: Path, dest_dir: Path, folder_name: str) -> None:
        if source_dir.exists():
            if dest_dir.exists():
                shutil.rmtree(dest_dir)
            shutil.copytree(source_dir, dest_dir)
            print(f"{folder_name.capitalize()} folder contents copied.")
        else:
            print(f"No {folder_name} folder found to copy")

    copy_folder(this_dir / "app" / "static", output_dir / "static", "Static")
    copy_folder(this_dir / "app" / "lite", output_dir / "lite", "lite")
    copy_folder(
        this_dir / "app" / "custom_functions",
        output_dir / "custom_functions",
        "custom_functions",
    )
    copy_folder(
        this_dir / "app" / "custom_scripts",
        output_dir / "custom_scripts",
        "custom_scripts",
    )

    # .env
    try:
        deploy_key = xlwings.pro.LicenseHandler.create_deploy_key()
    except xw.LicenseError:
        deploy_key = settings.license_key
    update_lite_settings(
        "XLWINGS_LICENSE_KEY", deploy_key, output_dir / "lite" / ".env"
    )
    if environment:
        update_lite_settings(
            "XLWINGS_ENVIRONMENT", environment, output_dir / "lite" / ".env"
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
        requirements_path = output_dir / "lite" / "requirements.txt"
        if not has_pyodide_requirement(requirements_path):
            remove_dir_if_exists(output_dir / "static" / "vendor" / "pyodide")

    # Remove unwanted files
    for cache_dir in (output_dir / "lite").rglob("__pycache__"):
        remove_dir_if_exists(cache_dir)

    for ds_store in output_dir.rglob(".DS_Store"):
        ds_store.unlink(missing_ok=True)

    # ZIP file
    if create_zip:
        zip_filename = output_dir / f"xlwings_lite_{build_timestamp}.zip"

        try:
            with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file_path in output_dir.rglob("*"):
                    if file_path.is_file() and file_path != zip_filename:
                        arcname = file_path.relative_to(output_dir)
                        zipf.write(file_path, arcname)
            print(f"Created zip file: {zip_filename}")
        except Exception as e:
            print(f"Error creating zip file: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="subcommand")
    init_parser = subparsers.add_parser("init", help="Initialize the application.")

    # Deps command
    deps_parser = subparsers.add_parser("deps", help="Manage dependencies.")
    deps_subparsers = deps_parser.add_subparsers(
        dest="deps_command",
        required=True,
        help="Use either 'deps sync' or 'deps upgrade'",
    )

    # Sync subcommand under deps
    compile_parser = deps_subparsers.add_parser(
        "compile", help="Synchronize dependencies."
    )
    upgrade_parser = deps_subparsers.add_parser("upgrade", help="Upgrade dependencies.")
    update_parser = deps_subparsers.add_parser("update", help="Upgrade dependencies.")

    # Lite command
    lite_parser = subparsers.add_parser("lite", help="Build xlwings Lite distribution")
    lite_parser.add_argument(
        "url", help="URL of where the xlwings Lite app is going to be hosted"
    )
    lite_parser.add_argument(
        "-o",
        "--output",
        help="Output directory path. Defaults to ./dist.",
        type=str,
        default="./dist",
    )
    lite_parser.add_argument(
        "-z",
        "--zip",
        help="Create zip archive in addition to the static files.",
        action="store_true",
    )
    lite_parser.add_argument(
        "-c",
        "--clean",
        help="Clean the output directory before building.",
        action="store_true",
    )
    lite_parser.add_argument(
        "-e",
        "--env",
        help="Sets the XLWINGS_ENVIRONMENT. By default uses the one from .env file.",
        type=str,
    )

    args = parser.parse_args()

    if args.subcommand == "init":
        init()
    elif args.subcommand == "deps":
        if args.deps_command == "compile":
            deps_compile()
        elif args.deps_command in ("upgrade", "update"):
            deps_compile(upgrade=True)
    elif args.subcommand == "lite":
        lite_build(
            url=args.url,
            output_dir=args.output,
            create_zip=args.zip,
            clean=args.clean,
            environment=args.env,
        )
    else:
        # Copy over required settings
        # TODO: This is currently only done when starting the server
        from app.config import settings  # noqa: E402

        env_file = this_dir / "app" / "lite" / ".env"
        create_lite_settings(settings, env_file)

        ssl_keyfile_path = this_dir / "certs" / "localhost+2-key.pem"
        ssl_certfile_path = this_dir / "certs" / "localhost+2.pem"

        ssl_keyfile = (
            str(ssl_keyfile_path)
            if ssl_keyfile_path.exists() and not is_cloud
            else None
        )
        ssl_certfile = (
            str(ssl_certfile_path)
            if ssl_certfile_path.exists() and not is_cloud
            else None
        )

        if (ssl_keyfile is None or ssl_certfile is None) and not is_cloud:
            print(
                "NO SSL KEYFILE OR CERTFILE FOUND. RUNNING ON HTTP, NOT HTTPS!.\n"
                "THIS WILL ONLY WORK WITH VBA AND OFFICE SCRIPTS, BUT NOT WITH "
                "OFFICE.JS ADD-INS!"
            )
        print(f"Running in '{'Lite' if settings.enable_lite else 'Server'}' mode.")
        uvicorn.run(
            "app.main:main_app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            reload_dirs=[this_dir],
            reload_includes=[".env"],
            ssl_keyfile=ssl_keyfile,
            ssl_certfile=ssl_certfile,
        )
