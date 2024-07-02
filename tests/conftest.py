import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

base_dir = Path(__file__).resolve().parent
load_dotenv(base_dir / os.getenv("ENV_FILE", ".env.test"), override=True)

# Don't import app before this point or settings won't be overridden


@pytest.fixture
def anyio_backend():
    return "asyncio"
