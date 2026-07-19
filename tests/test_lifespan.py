"""Tests for the optional user lifespan hook (PROJECT_DIR/lifespan.py).

`xlwings_server.main` reads XLWINGS_PROJECT_DIR and builds the app at import
time, so each scenario runs in a fresh subprocess with its own project dir.
The success case also confirms the lifespan propagates through the CORS/Socket.io
wrappers that wrap the inner FastAPI app in `main_app`.
"""

import os
import subprocess
import sys
import textwrap
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
REPO_DIR = BASE_DIR.parent


def _run_in_project(
    project_dir: Path, lifespan_src: str | None
) -> subprocess.CompletedProcess:
    """Write an optional lifespan.py into project_dir, then import main_app and
    drive it through a TestClient lifespan cycle in a subprocess. Returns the
    CompletedProcess so callers can assert on returncode/stdout/stderr."""
    if lifespan_src is not None:
        (project_dir / "lifespan.py").write_text(textwrap.dedent(lifespan_src))

    # The `with TestClient(...)` form triggers Starlette startup on enter and
    # shutdown on exit, which runs the app's lifespan context manager. A broken
    # lifespan.py instead fails at `import ... main_app` (module import time),
    # so the subprocess exits non-zero before reaching the TestClient block.
    driver = textwrap.dedent(
        """
        import os
        from pathlib import Path
        from dotenv import load_dotenv

        base_dir = Path(os.environ["TEST_BASE_DIR"])
        load_dotenv(base_dir / ".env.test", override=True)

        from fastapi.testclient import TestClient
        from xlwings_server.main import main_app

        with TestClient(main_app):
            print("REQUEST_PHASE")
        print("AFTER_EXIT")
        """
    )
    return subprocess.run(
        [sys.executable, "-c", driver],
        cwd=REPO_DIR,
        env={
            "XLWINGS_PROJECT_DIR": str(project_dir),
            "TEST_BASE_DIR": str(BASE_DIR),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
    )


def test_lifespan_hook_fires(tmp_path):
    """A lifespan.py exposing a `lifespan` context manager runs on startup and
    shutdown, in order, around request handling."""
    result = _run_in_project(
        tmp_path,
        """
        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def lifespan(app):
            print("STARTUP")
            yield
            print("SHUTDOWN")
        """,
    )
    assert result.returncode == 0, result.stderr
    out = result.stdout
    # startup -> request handling -> shutdown, in that order
    assert (
        out.index("STARTUP")
        < out.index("REQUEST_PHASE")
        < out.index("SHUTDOWN")
        < out.index("AFTER_EXIT")
    )


def test_no_lifespan_file_is_noop(tmp_path):
    """With no lifespan.py, the app still builds and serves unchanged."""
    result = _run_in_project(tmp_path, None)
    assert result.returncode == 0, result.stderr
    assert "REQUEST_PHASE" in result.stdout
    assert "AFTER_EXIT" in result.stdout


def test_broken_lifespan_fails_fast(tmp_path):
    """A lifespan.py that raises on import must abort startup, not be silently
    swallowed -- otherwise the server boots without the user's init code."""
    result = _run_in_project(
        tmp_path,
        """
        raise RuntimeError("boom during import")
        """,
    )
    assert result.returncode != 0
    assert "boom during import" in result.stderr
    # never reached the serving phase
    assert "REQUEST_PHASE" not in result.stdout


def test_lifespan_without_attribute_fails_fast(tmp_path):
    """A lifespan.py present but missing the `lifespan` attribute must abort
    startup rather than silently no-op."""
    result = _run_in_project(
        tmp_path,
        """
        # no `lifespan` defined here
        x = 1
        """,
    )
    assert result.returncode != 0
    assert "no `lifespan` context manager" in result.stderr
    assert "REQUEST_PHASE" not in result.stdout


def test_lifespan_registered_in_sys_modules(tmp_path):
    """The module is registered in sys.modules (under a private canonical name,
    resolvable via __name__) before exec, so __module__ resolution works and a
    self-referential import during module execution resolves to the same instance.
    The temporary bare-name alias is removed after execution."""
    result = _run_in_project(
        tmp_path,
        """
        import sys
        from contextlib import asynccontextmanager

        SENTINEL = object()
        # Canonical registration is under a private name == __name__.
        assert sys.modules[__name__].SENTINEL is SENTINEL
        # The bare `lifespan` name was free, so it aliases this same instance.
        import lifespan as _self
        assert _self is sys.modules[__name__]
        assert _self.SENTINEL is SENTINEL

        @asynccontextmanager
        async def lifespan(app):
            # __module__ resolves through sys.modules to the private name
            assert lifespan.__module__ == __name__
            print("SYS_MODULES_OK")
            yield
        """,
    )
    assert result.returncode == 0, result.stderr
    assert "SYS_MODULES_OK" in result.stdout


def test_lifespan_does_not_clobber_existing_module(tmp_path):
    """If a `lifespan` module is already imported, loading the hook must not
    overwrite it -- the pre-existing module stays intact."""
    # Pre-create an installed-style `lifespan` package on the path, then a
    # separate project-dir lifespan.py hook. The driver imports the package
    # first; loading the hook must leave sys.modules["lifespan"] untouched.
    pkg_dir = tmp_path / "pkgpath"
    pkg_dir.mkdir()
    (pkg_dir / "lifespan.py").write_text("MARKER = 'the-real-package'\n")

    project_dir = tmp_path / "project"
    project_dir.mkdir()
    (project_dir / "lifespan.py").write_text(
        textwrap.dedent(
            """
            from contextlib import asynccontextmanager

            @asynccontextmanager
            async def lifespan(app):
                yield
            """
        )
    )

    driver = textwrap.dedent(
        """
        import os, sys
        from pathlib import Path
        from dotenv import load_dotenv

        base_dir = Path(os.environ["TEST_BASE_DIR"])
        load_dotenv(base_dir / ".env.test", override=True)

        # Import the pre-existing `lifespan` package first.
        sys.path.insert(0, os.environ["PKG_PATH"])
        import lifespan as real
        assert real.MARKER == "the-real-package"

        from fastapi.testclient import TestClient
        from xlwings_server.main import main_app

        # The hook loaded, but the real `lifespan` package is untouched.
        assert sys.modules["lifespan"] is real
        assert sys.modules["lifespan"].MARKER == "the-real-package"
        with TestClient(main_app):
            pass
        print("NO_CLOBBER_OK")
        """
    )
    result = subprocess.run(
        [sys.executable, "-c", driver],
        cwd=REPO_DIR,
        env={
            "XLWINGS_PROJECT_DIR": str(project_dir),
            "PKG_PATH": str(pkg_dir),
            "TEST_BASE_DIR": str(BASE_DIR),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "NO_CLOBBER_OK" in result.stdout


def test_lifespan_alias_removed_after_loading(tmp_path):
    """The temporary bare-name alias is removed after module execution while
    the private canonical registration remains available for module metadata."""
    (tmp_path / "lifespan.py").write_text(
        textwrap.dedent(
            """
            from contextlib import asynccontextmanager

            @asynccontextmanager
            async def lifespan(app):
                yield
            """
        )
    )

    driver = textwrap.dedent(
        """
        import os, sys
        from pathlib import Path
        from dotenv import load_dotenv

        base_dir = Path(os.environ["TEST_BASE_DIR"])
        load_dotenv(base_dir / ".env.test", override=True)

        from xlwings_server.main import main_app

        assert "lifespan" not in sys.modules
        module = sys.modules["_xlwings_server_user_lifespan"]
        assert module.__file__ == os.path.join(
            os.environ["XLWINGS_PROJECT_DIR"], "lifespan.py"
        )
        print("ALIAS_REMOVED_OK")
        """
    )
    result = subprocess.run(
        [sys.executable, "-c", driver],
        cwd=REPO_DIR,
        env={
            "XLWINGS_PROJECT_DIR": str(tmp_path),
            "TEST_BASE_DIR": str(BASE_DIR),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "ALIAS_REMOVED_OK" in result.stdout
