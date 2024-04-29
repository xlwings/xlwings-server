import os
from pathlib import Path
from typing import List, Literal, Optional

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="XLWINGS_", env_file=os.getenv("DOTENV_PATH", ".env"), extra="ignore"
    )
    add_security_headers: bool = True
    base_dir: Path = Path(__file__).resolve().parent
    cors_allow_origins: List[str] = ["*"]
    enable_alpinejs_csp: bool = True
    enable_examples: bool = True
    enable_excel_online: bool = True
    enable_htmx: bool = True
    enable_socketio: bool = True
    entraid_client_id: Optional[str] = None
    entraid_tenant_id: Optional[str] = None
    # Set to False if you have users from external organizations
    entraid_validate_issuer: bool = True
    environment: Literal["development", "staging", "production"] = "development"
    hostname: Optional[str] = None
    log_level: str = "INFO"
    public_addin_store: bool = False
    license_key: str

    @computed_field
    @property
    def static_dir(self) -> Path:
        return self.base_dir / "static"


settings = Settings()

if not os.getenv("XLWINGS_LICENSE_KEY"):
    os.environ["XLWINGS_LICENSE_KEY"] = settings.license_key
