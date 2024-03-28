from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    add_security_headers: bool = True
    base_dir: Path = Path(__file__).resolve().parent
    cors_allow_origins: List[str] = ["*"]
    development: bool = False
    entraid_client_id: Optional[str] = None
    entraid_tenant_id: Optional[str] = None
    # Set to False if you have users from external organizations
    entraid_validate_issuer: bool = True
    log_level: str = "INFO"
    public_addin_store: bool = False
    static_dir: Path = base_dir / "static"
    xlwings_license_key: str

    class Config:
        env_file = ".env"


settings = Settings()
