import hashlib
import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

this_dir = Path(__file__).resolve().parent
static_dir = this_dir.parent / "app" / "static"
templates_dir = this_dir.parent / "app" / "templates"


class StaticFileHasher:
    def __init__(self, static_dir: Path, templates_dir: Path):
        self.static_dir = static_dir
        self.templates_dir = templates_dir
        self.file_mapping: Dict[
            str, Dict[str, str]
        ] = {}  # rel_path -> {old_name: new_name, path: Path}
        self.processed_files: Set[Path] = set()

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
            ".txt",
            ".scss",
            "fonts/",
            "vendor/@microsoft/office-js/dist/",
            "images/ribbon/",
        }

        path_str = str(path)
        return (
            "." in path.name  # requires extension
            and not any(pattern in path_str for pattern in excluded_patterns)
        )

    def hash_file(self, path: Path) -> str:
        """Generate a hash for the given file"""
        contents = path.read_bytes()
        return hashlib.sha256(contents).hexdigest()[:8]

    def generate_new_name(self, filename: str, digest: str) -> str:
        """Generate the new filename with hash included"""
        name, ext = os.path.splitext(filename)
        return f"{name}.{digest}{ext}"

    def get_replacement_patterns(
        self, file_path: Path, rel_path: str, old_name: str, new_name: str
    ) -> List[Tuple[str, str]]:
        """Generate all possible path patterns for replacement"""
        patterns = []
        dir_path = os.path.dirname(rel_path)

        # For absolute paths (mainly HTML references)
        abs_patterns = [
            (f"{rel_path}", f"{dir_path}/{new_name}"),
            (f"/{rel_path}", f"/{dir_path}/{new_name}"),
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

    def replace_in_file(self, file_path: Path, excluded_dirs: List[str] = None) -> None:
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
        """Process all static files and update references"""
        # First pass: hash all files and create mapping
        for source_path in static_dir.rglob("*"):
            if self.should_process_file(source_path):
                rel_path = self.get_relative_path(source_path, static_dir)
                rel_path_str = str(rel_path).replace("\\", "/")

                digest = self.hash_file(source_path)
                old_name = source_path.name
                new_name = self.generate_new_name(old_name, digest)

                self.file_mapping[rel_path_str] = {
                    "old_name": old_name,
                    "new_name": new_name,
                    "path": source_path,
                }

        # Second pass: rename files
        for file_info in self.file_mapping.values():
            old_path = file_info["path"]
            if old_path.exists():  # Check if not already renamed
                new_path = old_path.with_name(file_info["new_name"])
                old_path.rename(new_path)

        # Third pass: update references in files
        for template_file in templates_dir.rglob("*.html"):
            self.replace_in_file(template_file)

        for js_file in static_dir.rglob("*.js"):
            self.replace_in_file(js_file, excluded_dirs=["vendor"])

        for css_file in static_dir.rglob("*.css"):
            self.replace_in_file(css_file, excluded_dirs=["vendor"])


if __name__ == "__main__":
    hasher = StaticFileHasher(static_dir, templates_dir)
    hasher.process_files()
