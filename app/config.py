import os
from pathlib import Path
from typing import List, Literal, Optional

from pydantic import UUID4, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="XLWINGS_", env_file=os.getenv("DOTENV_PATH", ".env"), extra="ignore"
    )
    add_security_headers: bool = True
    app_path: str = ""
    base_dir: Path = Path(__file__).resolve().parent
    cors_allow_origins: List[str] = ["*"]
    enable_alpinejs_csp: bool = True
    enable_examples: bool = True
    enable_excel_online: bool = True
    enable_htmx: bool = True
    enable_socketio: bool = True
    entraid_client_id: Optional[str] = None
    entraid_tenant_id: Optional[str] = None
    entraid_validate_issuer: bool = True
    environment: Literal["dev", "qa", "uat", "prod"] = "prod"
    functions_namespace: str = "XLWINGS"
    hostname: Optional[str] = None
    log_level: str = "INFO"
    # These UUIDs will be overwritten by: python run.py init
    manifest_id_dev: UUID4 = "0a856eb1-91ab-4f38-b757-23fbe1f73130"
    manifest_id_qa: UUID4 = "9cda34b1-af68-4dc6-b97c-e63ef6284671"
    manifest_id_uat: UUID4 = "70428e53-8113-421c-8fe2-9b74fcb94ee5"
    manifest_id_prod: UUID4 = "4f342d85-3a49-41cb-90a5-37b1f2219040"
    project_name: str = "xlwings Server"
    public_addin_store: bool = False
    license_key: str

    @computed_field
    @property
    def static_dir(self) -> Path:
        return self.base_dir / "static"


settings = Settings()

if not os.getenv("XLWINGS_LICENSE_KEY"):
    os.environ["XLWINGS_LICENSE_KEY"] = settings.license_key
