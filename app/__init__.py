from pathlib import Path

# Store package directory for use throughout the application
# This is evaluated when the package is first imported, before any sys.path manipulation
PACKAGE_DIR = Path(__file__).parent.resolve()

from .config import settings  # noqa: E402
