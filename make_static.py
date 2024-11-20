import os
import shutil
import zipfile
from datetime import datetime
from pathlib import Path

os.environ["XLWINGS_ENABLE_SOCKETIO"] = "false"
from fastapi.testclient import TestClient

from app.main import main_app

base_url = "https://test-4rk.pages.dev"
client = TestClient(main_app)

output_dir = Path("static_site")
output_dir.mkdir(exist_ok=True)

routes = [
    ("/manifest.xml", "manifest.xml"),
    ("/taskpane.html", "taskpane.html"),
    ("/xlwings/custom-functions-meta.json", "xlwings/custom-functions-meta.json"),
    ("/xlwings/custom-functions-code.js", "xlwings/custom-functions-code.js"),
    (
        "/xlwings/custom-scripts-sheet-buttons.js",
        "xlwings/custom-scripts-sheet-buttons.js",
    ),
    ("/xlwings/pyscript.json", "xlwings/pyscript.json"),
]

for route, filename in routes:
    response = client.get(route)
    if response.status_code == 200:
        content = response.text
        if filename == "manifest.xml":
            content = content.replace("http://testserver", base_url)

        file_path = output_dir / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
    else:
        print(f"Failed to fetch {route} (status code: {response.status_code})")


print("Static site generation complete!")


def copy_folder(source_dir: Path, dest_dir: Path, folder_name: str) -> None:
    if source_dir.exists():
        if dest_dir.exists():
            shutil.rmtree(dest_dir)
        shutil.copytree(source_dir, dest_dir)
        print(f"{folder_name} folder contents copied!")
    else:
        print(f"No {folder_name} folder found to copy")


# Copy static and lite folders
copy_folder(Path("app/static"), output_dir / "static", "Static")
copy_folder(Path("app/lite"), output_dir / "lite", "lite")


# Cleanup
def remove_dir_if_exists(path: Path) -> None:
    """Remove directory at path if it exists."""
    if path.exists():
        shutil.rmtree(path)


# Remove cache and vendor directories
remove_dir_if_exists(output_dir / "lite" / "__pycache__")
remove_dir_if_exists(output_dir / "static" / "vendor" / "socket.io")


# Create zip file
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
zip_filename = f"static_site_{timestamp}.zip"

try:
    with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path in output_dir.rglob("*"):
            if file_path.is_file():
                arcname = file_path.relative_to(output_dir)
                zipf.write(file_path, arcname)
    print(f"Created zip file: {zip_filename}")
except Exception as e:
    print(f"Error creating zip file: {e}")
