import os
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=os.getenv("DOTENV_PATH", ".env"))
    add_security_headers: bool = True
    base_dir: Path = Path(__file__).resolve().parent
    cors_allow_origins: List[str] = ["*"]
    development: bool = False
    enable_alpinejs_csp: bool = True
    enable_examples: bool = True
    enable_excel_online: bool = True
    enable_htmx: bool = True
    entraid_client_id: Optional[str] = None
    entraid_tenant_id: Optional[str] = None
    # Set to False if you have users from external organizations
    entraid_validate_issuer: bool = True
    log_level: str = "INFO"
    public_addin_store: bool = False
    static_dir: Path = base_dir / "static"
    xlwings_license_key: str


settings = Settings()

if not os.getenv("XLWINGS_LICENSE_KEY"):
    os.environ["XLWINGS_LICENSE_KEY"] = settings.xlwings_license_key
