from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    base_dir: Path = Path(__file__).resolve().parent
    static_dir: Path = base_dir / "static"
    cors_allow_origins: List[str] = ["*"]


settings = Settings()
