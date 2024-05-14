import argparse
import os
import re
import shutil
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="subcommand")
    init_parser = subparsers.add_parser("init", help="Initialize the application.")

    args = parser.parse_args()
    if args.subcommand == "init":
        init()
    else:
        uvicorn.run(
            "app.main:main_app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            ssl_keyfile="certs/localhost+2-key.pem" if not is_cloud else None,
            ssl_certfile="certs/localhost+2.pem" if not is_cloud else None,
        )
