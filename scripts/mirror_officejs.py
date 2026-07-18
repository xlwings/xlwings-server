"""Mirror the Office.js library from Microsoft's CDN into the vendor folder.

Microsoft stopped publishing the ``@microsoft/office-js`` npm package (frozen at
1.1.110, April 2025) and now serves Office.js only from the hosted CDN at
https://appsforoffice.microsoft.com/lib/1/hosted/. That's fine for internet-
connected add-ins, but airgapped/self-hosted deployments need the files vendored
locally (this is what ``settings.cdn_officejs = false`` serves). This script
replaces the dead npm upgrade path: it re-downloads the exact set of files we
vendor from the CDN, so the local copy can be refreshed to the current build.

Inventory: officejs_inventory.py holds the curated set of files to mirror (the
Excel-only subset the hosted CDN actually serves; every hosted file resolves at
a flat path under .../hosted/<relpath>). ``*.debug.js`` is excluded (only needed
for debugging office.js itself; Excel requests the non-debug bundles at runtime).
``LICENSE.md`` isn't on the CDN, so it's fetched from the OfficeDev/office-js
repo instead.

Usage:
    make officejs                                    # refresh into a new dir
    uv run scripts/mirror_officejs.py                # same, without uv sync
    uv run scripts/mirror_officejs.py --dry-run      # list what would be fetched
"""

import re
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx

this_dir = Path(__file__).resolve().parent
root_dir = this_dir.parent
vendor_dir = root_dir / "xlwings_server" / "static" / "vendor"

CDN_BASE = "https://appsforoffice.microsoft.com/lib/1/hosted/"

# LICENSE.md isn't served from the hosted CDN; it lives at the root of the
# OfficeDev/office-js repo (the same license the npm package shipped).
LICENSE_URL = "https://raw.githubusercontent.com/OfficeDev/office-js/release/LICENSE.md"

# Where mirrored files live. We move off the npm-scoped "@microsoft/office-js"
# path (npm is dead) to a plain "office-js" folder, versioned by the CDN build.
OUTPUT_PARENT = vendor_dir / "office-js"

MAX_WORKERS = 16

# office.js embeds its build version as e.g. "16.0.20308.15050". We use that to
# name the version dir so refreshes are cache-busted and traceable to a build.
VERSION_RE = re.compile(rb'"(16\.0\.\d{3,}\.\d{3,})"')


def get_inventory() -> list[str]:
    """The curated list of Office.js files to mirror (officejs_inventory.py).

    This static list is the sole source of truth -- the mirror always downloads
    exactly these files and never inspects the existing vendored tree. It's
    pruned to files the hosted CDN actually serves, so any 404 during mirroring
    is a real error (the CDN changed), not an expected miss.
    """
    from officejs_inventory import OFFICEJS_FILES

    return list(OFFICEJS_FILES)


# One pooled, thread-safe client shared across the concurrent fetches. The
# transport retries connection errors; httpx follows redirects (the CDN 301s a
# few paths).
_client = httpx.Client(
    headers={"User-Agent": "xlwings-server"},
    timeout=30,
    follow_redirects=True,
    transport=httpx.HTTPTransport(retries=3),
)


def _get(url: str, *, on_404: str | None = None) -> bytes:
    last_err = None
    for _ in range(3):
        resp = _client.get(url)
        if resp.status_code == 404 and on_404 is not None:
            raise RuntimeError(on_404)
        if resp.is_success:
            return resp.content
        last_err = f"HTTP {resp.status_code}"  # 5xx / transient: retry
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def fetch(relpath: str) -> bytes:
    # The inventory is curated to CDN-available files, so a 404 means the CDN
    # changed -- surface it rather than silently dropping.
    return _get(
        CDN_BASE + relpath,
        on_404=(
            f"{relpath} is no longer on the CDN (404). The hosted build changed; "
            "regenerate officejs_inventory.py."
        ),
    )


def exists(relpath: str) -> bool:
    """True if the CDN serves this file (HEAD-style existence check).

    Only a definitive 404 means "absent". A transient/5xx failure that survives
    retries is raised, not swallowed -- otherwise a CDN outage would make the
    drift check silently report "no new bundles" when it actually probed nothing.
    """
    last_err = None
    for _ in range(3):
        resp = _client.head(CDN_BASE + relpath)
        if resp.status_code == 404:
            return False
        if resp.is_success:
            return True
        last_err = f"HTTP {resp.status_code}"
    raise RuntimeError(f"Failed to probe {relpath}: {last_err}")


# Excel host bundles aren't listed in any manifest -- office.js builds their
# names at runtime from templates. To notice new bundles (e.g. a future
# "excel-17" or a new minor like "excel-web-16.01"), we probe the name-space the
# same way: for each series we vendor, try the next minors and the next majors.
# Excel bundle names look like "<prefix>-<major>.<minor>[-core].js" where the
# prefix may itself contain digits (excel-win32, excel-winrt). Anchor the
# version as the final "-<digits>.<digits>" group so the greedy prefix keeps the
# platform token intact.
_BUNDLE_RE = re.compile(
    r"^(?P<prefix>[a-z][a-z0-9-]*?)-(?P<major>\d+)\.(?P<minor>\d+)(?P<core>-core)?\.js$"
)
# The 15.x line also has bare-major names with no minor: "excel-15.js".
_BUNDLE_RE_15 = re.compile(r"^(?P<prefix>excel(?:webapp)?)-(?P<major>15)\.js$")


def check_for_new_bundles(inventory: list[str]) -> list[str]:
    """Probe the CDN for Excel bundles not yet in the inventory. Returns new ones.

    Detection is driven by the *dimensions* we already ship (platform prefixes
    and major generations), independent of any single file -- so it still flags a
    bundle even if that exact bundle is the one missing from the inventory. For
    every known prefix x major (plus the next two majors, e.g. a future 17/18),
    we probe minors 00..05 in both plain and -core forms.
    """
    have = set(inventory)
    prefixes: set[str] = set()
    majors: set[int] = set()
    for rel in inventory:
        name = rel.rsplit("/", 1)[-1]
        m = _BUNDLE_RE.match(name) or _BUNDLE_RE_15.match(name)
        if m:
            prefixes.add(m["prefix"])
            majors.add(int(m["major"]))

    # Include the next major generations so a brand-new "excel-*-17.xx" is found.
    majors |= {mj + 1 for mj in majors} | {mj + 2 for mj in majors}

    candidates: set[str] = set()
    for prefix in prefixes:
        for major in majors:
            for minor in range(0, 6):
                candidates.add(f"{prefix}-{major}.{minor:02d}.js")
                candidates.add(f"{prefix}-{major}.{minor:02d}-core.js")

    to_probe = sorted(c for c in candidates if c not in have)
    found = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        for rel, ok in zip(to_probe, pool.map(exists, to_probe), strict=True):
            if ok:
                found.append(rel)
    return found


def detect_version(office_js: bytes) -> str:
    matches = VERSION_RE.findall(office_js)

    # office.js contains a few 16.0.* strings; the build version is the one with
    # large numeric segments (placeholders like 16.0.0000.0000 also match the
    # broad pattern, so pick the max by numeric tuple).
    def as_tuple(v: bytes) -> tuple[int, ...]:
        return tuple(int(p) for p in v.split(b"."))

    if not matches:
        raise SystemExit("Could not detect office.js build version from CDN copy.")
    return max(matches, key=as_tuple).decode()


def mirror(dry_run: bool = False) -> None:
    relpaths = get_inventory()
    print(f"Inventory: {len(relpaths)} CDN-available files")

    # Fetch office.js first to learn the build version (and validate the CDN).
    print("Fetching office.js to detect build version...")
    office_js = fetch("office.js")
    version = detect_version(office_js)
    print(f"CDN build version: {version}")

    final_dir = OUTPUT_PARENT / version
    dest_dist = final_dir / "dist"
    if dry_run:
        print(f"[dry-run] Would mirror {len(relpaths)} files into {dest_dist}")
        for rel in relpaths[:10]:
            print(f"  {rel}")
        if len(relpaths) > 10:
            print(f"  ... and {len(relpaths) - 10} more")
        return

    # Download everything into a staging dir first, validate it, then swap it
    # into place atomically -- so a mid-run failure (bad file, network drop,
    # license fetch) never leaves a partial tree that base.html already points
    # at. The staging dir is a sibling of the final dir (same filesystem) so the
    # rename is atomic.
    OUTPUT_PARENT.mkdir(parents=True, exist_ok=True)
    staging = OUTPUT_PARENT / f".{version}.tmp"
    if staging.exists():
        shutil.rmtree(staging)
    staging_dist = staging / "dist"
    staging_dist.mkdir(parents=True)

    try:
        # office.js already fetched — write it, then fetch the rest concurrently.
        (staging_dist / "office.js").write_bytes(office_js)
        remaining = [r for r in relpaths if r != "office.js"]

        errors = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(fetch, rel): rel for rel in remaining}
            done = 0
            for future in as_completed(futures):
                rel = futures[future]
                try:
                    data = future.result()
                except Exception as e:  # noqa: BLE001
                    errors.append((rel, str(e)))
                    continue
                out = staging_dist / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(data)
                done += 1
                if done % 25 == 0:
                    print(f"  {done}/{len(remaining)}...")

        if errors:
            print(f"\n⚠ {len(errors)} file(s) failed to download:")
            for rel, msg in errors[:20]:
                print(f"  {rel}: {msg}")
            raise SystemExit(1)

        # License last -- if it fails, we still haven't touched the live tree.
        (staging / "LICENSE.md").write_bytes(_get(LICENSE_URL))
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise

    # Everything downloaded and validated. Bring the new version into place and
    # point base.html at it BEFORE deleting any old versions -- so if the
    # reference update fails, the previously referenced tree is still there.
    remember = _list_version_dirs()  # existing versions, to prune only on success
    if final_dir.exists():
        shutil.rmtree(final_dir)
    staging.rename(final_dir)

    # Point base.html at the new version. If this raises (or finds no path to
    # update), we stop here WITHOUT pruning -- the old versions stay in place so
    # the app keeps referencing a tree that still exists.
    update_version_refs(version)

    # Reference now points at the new version -- safe to remove the old ones.
    for old in remember:
        if old != final_dir and old.exists():
            shutil.rmtree(old)

    print(f"\n✓ Mirrored {done + 1} files into {dest_dist}")


def _list_version_dirs() -> list[Path]:
    if not OUTPUT_PARENT.is_dir():
        return []
    return [d for d in OUTPUT_PARENT.iterdir() if d.is_dir()]


def update_version_refs(version: str) -> None:
    """Point base.html at the freshly mirrored office.js path.

    Raises if no Office.js <script> path is found to update -- a silent no-op
    here would leave base.html referencing an old version that the caller is
    about to delete.
    """
    base_html = root_dir / "xlwings_server" / "templates" / "base.html"
    content = base_html.read_text()
    # Match both the legacy npm path and any prior mirrored path.
    pattern = r"/vendor/(?:@microsoft/)?office-js/[^/]+/dist/office\.js"
    replacement = f"/vendor/office-js/{version}/dist/office.js"
    new_content, n = re.subn(pattern, replacement, content)
    if n == 0:
        raise RuntimeError(
            f"No office.js <script> path found in {base_html.name}; refusing to "
            "prune old versions while the reference is unresolved."
        )
    if new_content != content:
        base_html.write_text(new_content)
        print(f"✓ Updated office.js path in {base_html.name} -> {version}")
    else:
        print(f"✓ office.js path in {base_html.name} already at {version}")


def check() -> None:
    """Probe the CDN for new Excel bundles missing from the inventory."""
    inventory = get_inventory()
    print(f"Probing for Excel bundles beyond the {len(inventory)} in the inventory...")
    new = check_for_new_bundles(inventory)
    if not new:
        print("✓ No new Excel bundles found on the CDN.")
        return
    print(f"\n⚠ {len(new)} new bundle(s) on the CDN not in officejs_inventory.py:")
    for rel in new:
        print(f"  {rel}")
    print("\nAdd them to scripts/officejs_inventory.py, then run a mirror.")
    raise SystemExit(1)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be fetched without downloading.",
    )
    group.add_argument(
        "--check",
        action="store_true",
        help="Probe the CDN for new Excel bundles missing from the inventory "
        "(e.g. a future excel-17); exits non-zero if any are found.",
    )
    args = parser.parse_args()
    if args.check:
        check()
    else:
        mirror(dry_run=args.dry_run)
