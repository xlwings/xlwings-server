import json
import re
import shutil
from pathlib import Path

this_dir = Path(__file__).resolve().parent
root_dir = this_dir.parent

node_modules_dir = root_dir / "node_modules"
vendor_dir = root_dir / "xlwings_server" / "static" / "vendor"

# Packages to copy: package_name -> list of paths to copy (relative to package
# dir). Use None to copy the entire package.
# Versions are read from each package's installed package.json so that both
# registry deps and git deps (e.g. bootstrap-xlwings) work uniformly.
# Pyodide is intentionally excluded: it has its own version system handled by
# add_pyodide_version.py / settings.pyodide_base_url.
#
# Global UMD builds vs. ESM: with the exception of @alpinejs/csp (see below),
# these are vendored as global UMD scripts on purpose, NOT as ESM imports.
# Reasons it's not worth switching the others to ESM:
#   - axios and the socket.io client `io` are also read as globals from
#     custom-functions/custom-functions-code.js, which runs in a separate
#     custom-functions runtime and must stay a classic, import-free script. An
#     ESM import in the task pane wouldn't remove the need for the global there,
#     so we'd end up maintaining two load paths for one library.
#   - htmx and bootstrap are auto-initializing, global-script libraries (htmx
#     attaches to window and scans the DOM via its own lifecycle; bootstrap is
#     driven purely by data-bs-* attributes + CSS with zero JS usage in our
#     code). ESM-importing them gains nothing and breaks their auto-init.
# office.js has no ESM build at all. So global UMD is the simpler fit for our
# two-runtime architecture (task pane + custom-functions runtime).
#
# @alpinejs/csp is the deliberate exception: its single self-contained ESM build
# (no bare imports, so no bundler needed -- unlike monaco-editor) does NOT
# auto-start, unlike the cdn build which does `window.Alpine = X;
# queueMicrotask(() => X.start())` with no opt-out. The ESM build lets the
# starter in base.html call Alpine.start() itself, AFTER custom JS modules have
# registered their components -- eliminating the start-time race that the cdn
# build forced. It is also only consumed in the task pane (not the CF runtime).
# See integrations/alpinejs-csp.js and integrations/alpinejs-start.js.
packages = {
    "@alpinejs/csp": ["dist/module.esm.min.js"],
    "@microsoft/office-js": ["dist", "LICENSE.md"],
    "axios": ["dist/axios.min.js"],
    "bootstrap": ["dist/js/bootstrap.bundle.min.js", "LICENSE"],
    "bootstrap-xlwings": [
        "dist/bootstrap-xlwings.min.css",
        "dist/bootstrap-xlwings.min.css.map",
    ],
    "htmx-ext-head-support": ["head-support.js"],
    "htmx-ext-loading-states": ["loading-states.js"],
    "htmx.org": ["dist/htmx.min.js", "LICENSE"],
    "socket.io": ["client-dist/socket.io.min.js", "LICENSE"],
}


def read_version(package_name: str) -> str:
    pkg_json = node_modules_dir / package_name / "package.json"
    return json.loads(pkg_json.read_text())["version"]


versions = {name: read_version(name) for name in packages}

# Clean previously copied versions of managed packages so old version dirs
# don't linger. Pyodide is left alone (not in `packages`).
managed_top_level = {name.split("/")[0] for name in packages}
for item in vendor_dir.iterdir():
    if item.is_dir() and item.name in managed_top_level:
        shutil.rmtree(item)

for package_name, paths in packages.items():
    version = versions[package_name]
    dest_dir = vendor_dir / package_name / version
    src_dir = node_modules_dir / package_name

    if paths is None:
        shutil.copytree(src_dir, dest_dir, dirs_exist_ok=True)
    else:
        dest_dir.mkdir(parents=True, exist_ok=True)
        for path in paths:
            src = src_dir / path
            dst = dest_dir / path
            if src.is_dir():
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(src, dst)
                if src.suffix == ".js" and src.with_suffix(".js.map").is_file():
                    shutil.copy(
                        src.with_suffix(".js.map"),
                        dst.with_suffix(".js.map"),
                    )

    print(f"✓ Copied {package_name} {version}")

# Alpine.js is missing the LICENSE file in the node distribution
alpinejs_license = """\
# MIT License

Copyright © 2019-2021 Caleb Porzio and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
(vendor_dir / "@alpinejs" / "csp" / versions["@alpinejs/csp"] / "LICENSE").write_text(
    alpinejs_license
)

# Remove non-Excel-related office-js files
officejs_dir = (
    vendor_dir / "@microsoft" / "office-js" / versions["@microsoft/office-js"] / "dist"
)
prefixes = ["access*", "onenote*", "outlook*", "word*", "project*", "powerpoint*"]
for prefix in prefixes:
    for filename in officejs_dir.rglob(prefix):
        filename.unlink()

# Update version references in source files so the version-bump workflow is
# just `npm install <pkg>@latest`. The regex matches the version segment in
# /vendor/<pkg>/<version>/... — any non-slash chars, to accommodate
# non-semver versions like bootstrap-xlwings's "5.3.3-2". base.html references
# vendored files via url_for(); alpinejs-start.js imports the Alpine ESM build
# via a relative /vendor/ path, so it carries a version too.
static_dir = root_dir / "xlwings_server" / "static"
version_ref_files = [
    root_dir / "xlwings_server" / "templates" / "base.html",
    static_dir / "js" / "integrations" / "alpinejs-start.js",
]
for source_file in version_ref_files:
    content = source_file.read_text()
    new_content = content
    for package_name in packages:
        version = versions[package_name]
        pkg_re = re.escape(package_name)
        pattern = rf"/vendor/{pkg_re}/[^/]+/"
        replacement = f"/vendor/{package_name}/{version}/"
        new_content = re.sub(pattern, replacement, new_content)
    if content != new_content:
        source_file.write_text(new_content)
        print(f"✓ Updated vendored versions in {source_file.name}")
