"""Static file hasher for cache-busting in production builds.

This module provides the StaticFileHasher class which adds a per-build tag
to static file names (e.g., main.js -> main.a1b2c3d4.js) and updates all
references in HTML, JS, and CSS files accordingly. This is used to enable
effective cache-busting in production deployments.

A single build_id is used for every file in a build (rather than per-file
content hashes). This is intentional: it ensures a referencing file's
embedded reference and the file it points to are invalidated together, and
it avoids the propagation problem where a content-stable file (e.g. wasm.js)
ends up with a stale embedded reference to a dependency whose hash changed.
The cost is that one build invalidates every cached asset.
"""

import os
import re
import secrets
from pathlib import Path
from typing import TypedDict


class FileMappingEntry(TypedDict):
    old_name: str
    new_name: str
    path: Path


class StaticFileHasher:
    """Tags static files with a per-build id and updates references.

    Renames eligible files (e.g., main.js -> main.a1b2c3d4.js) using a single
    build_id shared across the whole build, then rewrites references in HTML,
    JS, and CSS to match.

    Args:
        static_dir: Directory containing static files to tag
        templates_dir: Directory containing templates with references to update
        build_id: Optional build identifier; a random 8-char value is used if
            not given. Pin it (e.g. to package version + git SHA) for
            reproducible builds.
    """

    def __init__(
        self, static_dir: Path, templates_dir: Path, build_id: str | None = None
    ):
        self.static_dir = static_dir
        self.templates_dir = templates_dir
        # One tag per build, used as the suffix on every renamed file. A
        # caller may pin it (e.g. to the package version + git SHA); otherwise
        # we generate a random 8-char value so back-to-back builds differ.
        self.build_id = build_id or secrets.token_hex(4)
        # rel_path -> entry describing the rename
        self.file_mapping: dict[str, FileMappingEntry] = {}
        self.processed_files: set[Path] = set()

    def get_relative_path(self, path: Path, base_dir: Path) -> Path:
        """Get the relative path from base_dir to the given path"""
        try:
            return path.relative_to(base_dir)
        except ValueError:
            return path

    def should_process_file(self, path: Path) -> bool:
        """Determine if a file should be processed based on various criteria"""
        if not path.is_file() or path.name.startswith("."):
            return False

        excluded_patterns = {
            ".map",
            ".md",
            ".py",
            ".scss",
            ".txt",
            ".whl",
            ".xml",
            "custom-functions-code.js",
            "custom-functions-meta.json",
            "eula.html",
            "fonts/",
            "images/ribbon/",
            "images/icons/",
            "images/xlwings-",
            "index.html",
            "manifest.xml",
            "privacy.html",
            "support.html",
            "taskpane.html",
            "vendor/",
        }

        path_str = path.as_posix()
        return (
            "." in path.name  # requires extension
            and not any(pattern in path_str for pattern in excluded_patterns)
        )

    def generate_new_name(self, filename: str) -> str:
        """Generate the new filename with the build_id included"""
        name, ext = os.path.splitext(filename)
        return f"{name}.{self.build_id}{ext}"

    def get_replacement_patterns(
        self, file_path: Path, rel_path: str, old_name: str, new_name: str
    ) -> list[tuple[str, str]]:
        """Generate all possible path patterns for replacement"""
        patterns = []
        dir_path = os.path.dirname(rel_path)
        # Join dir_path + filename without producing a leading "/" when
        # dir_path is empty (top-level file). Absolute patterns prepend "/"
        # separately below.
        old_abs = f"{dir_path}/{old_name}" if dir_path else old_name
        new_abs = f"{dir_path}/{new_name}" if dir_path else new_name

        # Absolute paths (mainly HTML references)
        abs_patterns = [
            (old_abs, new_abs),
            (f"/{old_abs}", f"/{new_abs}"),
        ]

        # For relative paths (mainly JS imports)
        try:
            current_dir = file_path.parent.relative_to(self.static_dir)
            target_dir = Path(dir_path)
            rel_import_path = os.path.relpath(target_dir, current_dir)

            # Handle the case where files are in the same directory
            if rel_import_path == ".":
                rel_patterns = [
                    (f"./{old_name}", f"./{new_name}"),
                    (old_name, new_name),
                ]
            else:
                rel_import_path = rel_import_path.replace("\\", "/")
                if not rel_import_path.startswith("."):
                    rel_import_path = f"./{rel_import_path}"
                rel_patterns = [
                    (f"{rel_import_path}/{old_name}", f"{rel_import_path}/{new_name}"),
                ]
        except ValueError:
            rel_patterns = []

        # Combine all patterns
        all_paths = abs_patterns + rel_patterns

        # Generate variations for each pattern
        for old_path, new_path in all_paths:
            # Normalize slashes
            old_path = old_path.replace("\\", "/")
            new_path = new_path.replace("\\", "/")

            # Remove any double slashes
            old_path = re.sub(r"/{2,}", "/", old_path)
            new_path = re.sub(r"/{2,}", "/", new_path)

            variations = [
                (old_path, new_path),
                (f"'{old_path}'", f"'{new_path}'"),
                (f'"{old_path}"', f'"{new_path}"'),
                (f'from "{old_path}"', f'from "{new_path}"'),
                (f"from '{old_path}'", f"from '{new_path}'"),
                (f'import "{old_path}"', f'import "{new_path}"'),
                (f"import '{old_path}'", f"import '{new_path}'"),
                (f"url({old_path})", f"url({new_path})"),
                (f'url("{old_path}")', f'url("{new_path}")'),
                (f"url('{old_path}')", f"url('{new_path}')"),
            ]
            patterns.extend(variations)

        return patterns

    def replace_in_file(
        self, file_path: Path, excluded_dirs: list[str] | None = None
    ) -> None:
        """Replace all occurrences of original filenames with hashed versions"""
        if excluded_dirs is None:
            excluded_dirs = []

        if any(excluded_dir in file_path.parts for excluded_dir in excluded_dirs):
            return

        content = file_path.read_text()
        new_content = content

        # Sort paths by length (longest first) to avoid partial replacements
        sorted_paths = sorted(self.file_mapping.keys(), key=len, reverse=True)

        for rel_path in sorted_paths:
            file_info = self.file_mapping[rel_path]
            old_name = file_info["old_name"]
            new_name = file_info["new_name"]

            patterns = self.get_replacement_patterns(
                file_path, rel_path, old_name, new_name
            )

            for old_pattern, new_pattern in patterns:
                new_content = new_content.replace(old_pattern, new_pattern)

        if new_content != content:
            file_path.write_text(new_content)

    def process_files(self):
        """Rename eligible static files to include the per-build tag and
        rewrite references in HTML/JS/CSS to point at the new names.

        Because every file shares the same build_id suffix, a single rewrite
        pass is enough — no convergence loop is needed (unlike per-file
        content hashing, where rewriting a reference can change the
        referencing file's own hash).
        """
        # First pass: build the rename mapping for every eligible file.
        for source_path in self.static_dir.rglob("*"):
            if self.should_process_file(source_path):
                rel_path = self.get_relative_path(source_path, self.static_dir)
                rel_path_str = str(rel_path).replace("\\", "/")
                old_name = source_path.name
                new_name = self.generate_new_name(old_name)
                self.file_mapping[rel_path_str] = {
                    "old_name": old_name,
                    "new_name": new_name,
                    "path": source_path,
                }

        # Second pass: rewrite references first (while files still live at
        # their original paths and referencing files contain the old names).
        for template_file in self.templates_dir.rglob("*.html"):
            self.replace_in_file(template_file)

        for js_file in self.static_dir.rglob("*.js"):
            self.replace_in_file(js_file, excluded_dirs=["vendor"])

        for css_file in self.static_dir.rglob("*.css"):
            self.replace_in_file(css_file, excluded_dirs=["vendor"])

        # Third pass: rename files on disk.
        for file_info in self.file_mapping.values():
            old_path = file_info["path"]
            if old_path.exists():
                new_path = old_path.with_name(file_info["new_name"])
                old_path.rename(new_path)
