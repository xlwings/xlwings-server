import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

base_dir = Path(__file__).resolve().parent
env_file = base_dir / os.getenv("ENV_FILE", ".env.test")
load_dotenv(env_file, override=True)
# Point Settings at the test env file instead of the project's .env, so local
# settings (e.g., XLWINGS_ENABLE_TESTS=true) don't leak into the tests
os.environ["DOTENV_PATH"] = str(env_file)

# Don't import app before this point or settings won't be overridden


@pytest.fixture
def anyio_backend():
    return "asyncio"
