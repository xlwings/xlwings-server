import argparse
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

import uvicorn

is_cloud = os.getenv("CODESPACES") or os.getenv("GITPOD_WORKSPACE_ID")


def replace_uuids():
    file_path = "app/config.py"
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
    if not Path(".env").exists():
        shutil.copy(".env.template", ".env")


def init():
    replace_uuids()
    create_dotenv()
    print("Success! Now open the .env file and add a license key")


def deps_compile(upgrade=False):
    # The order of how these files matters because they are all interdependent
    file_names = ["requirements-core", "requirements", "requirements-dev"]
    for file_name in file_names:
        cmd_linux = f"uv pip compile {file_name}.in -o {file_name}.txt --python-platform linux {'--upgrade' if upgrade else ''}"
        cmd_win = f"uv pip compile {file_name}.in -o {file_name}-win.txt --unsafe-package pywin32 --python-platform windows {'--upgrade' if upgrade else ''}"
        for cmd in [cmd_linux, cmd_win]:
            subprocess.run(cmd, shell=True, check=True)
    print(
        f"Success! Requirements files {'upgraded' if upgrade else 'compiled'} successfully. Now commit the requirements.txt files!"
    )


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

    args = parser.parse_args()

    if args.subcommand == "init":
        init()
    elif args.subcommand == "deps":
        if args.deps_command == "compile":
            deps_compile()
        elif args.deps_command in ("upgrade", "update"):
            deps_compile(upgrade=True)
    else:
        ssl_keyfile_path = Path("certs/localhost+2-key.pem")
        ssl_certfile_path = Path("certs/localhost+2.pem")

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
        uvicorn.run(
            "app.main:main_app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            reload_includes=[".py", ".env"],
            ssl_keyfile=ssl_keyfile,
            ssl_certfile=ssl_certfile,
        )
