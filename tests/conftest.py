from pathlib import Path

from dotenv import load_dotenv

base_dir = Path(__file__).resolve().parent
load_dotenv(base_dir / ".env.test", override=True)

# Don't import app before this point or settings won't be overridden
