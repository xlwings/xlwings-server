from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    base_dir: Path = Path(__file__).resolve().parent
    static_dir: Path = base_dir / "static"
    cors_allow_origins: List[str] = ["*"]
    log_level: str = "INFO"
    entraid_tenant_id: Optional[str] = None
    entraid_client_id: Optional[str] = None
    # Set to False if you have users from external organisations
    entraid_validate_issuer: bool = True


settings = Settings()
