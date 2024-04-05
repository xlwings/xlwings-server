"""
Doesn't currently handle
- The @import rule and url() statement in CSS
- Source map comments in CSS and JavaScript files.
See https://docs.djangoproject.com/en/dev/ref/contrib/staticfiles/#django.contrib.staticfiles.storage.ManifestStaticFilesStorage
"""

import hashlib
from pathlib import Path

this_dir = Path(__file__).resolve().parent

static_dir = this_dir.parent / "app" / "static"
templates_dir = this_dir.parent / "app" / "templates"


for source_path in static_dir.rglob("*"):
    if (
        source_path.is_file()
        and not source_path.name.startswith(".")
        and not source_path.name.endswith((".map", ".md", ".txt", ".scss"))
        and "." in source_path.name  # requires extension
        and "fonts" not in str(source_path)
        and "vendor/@microsoft/office-js/dist" not in str(source_path)
    ):
        contents = source_path.read_bytes()
        digest = hashlib.sha256(contents).hexdigest()[:8]
        new_filename = f"{source_path.stem}.{digest}{source_path.suffix}"
        new_path = source_path.with_name(new_filename)
        source_path.rename(new_path)
        for html_path in templates_dir.rglob("*.html"):
            contents = html_path.read_text()
            new_contents = contents.replace(source_path.name, new_filename)
            html_path.write_text(new_contents)
