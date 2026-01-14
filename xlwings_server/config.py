import os
import warnings
from pathlib import Path
from typing import Literal

import xlwings as xw
from pydantic import UUID4, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get project directory from environment (set by CLI)
# Falls back to current working directory if not set (for backward compatibility)
PROJECT_DIR = Path(os.getenv("XLWINGS_PROJECT_DIR", Path.cwd()))

# Get package directory - must be calculated before any sys.path manipulation
# Use __file__ which points to the actual config.py location (in site-packages after install)
PACKAGE_DIR = Path(__file__).parent.resolve()


def load_pyproject_config() -> dict:
    """Load xlwings-server config from [tool.xlwings_server] section in pyproject.toml"""
    pyproject_path = PROJECT_DIR / "pyproject.toml"
    if not pyproject_path.exists():
        return {}

    try:
        import tomlkit

        content = pyproject_path.read_text()
        data = tomlkit.parse(content)
        return data.get("tool", {}).get("xlwings_server", {})
    except Exception:
        return {}


class Settings(BaseSettings):
    """See .env.template for documentation"""

    # Load config from pyproject.toml [tool.xlwings_server] section
    _pyproject_config: dict = load_pyproject_config()

    def __init__(self, **values):
        super().__init__(**values)
        if self.public_addin_store is not None:
            warnings.warn(
                "The 'XLWINGS_PUBLIC_ADDIN_STORE' field is deprecated and will be removed in "
                "future versions. Use 'XLWINGS_CDN_OFFICEJS' instead.",
                DeprecationWarning,
            )
            self.cdn_officejs = self.public_addin_store

    model_config = SettingsConfigDict(
        env_prefix="XLWINGS_",
        env_file=os.getenv("DOTENV_PATH", PROJECT_DIR / ".env"),
        extra="ignore",
    )
    add_security_headers: bool = True
    auth_providers: list[str] | None = []
    auth_required_roles: list[str] | None = []
    auth_entraid_client_id: str | None = None
    auth_entraid_tenant_id: str | None = None
    auth_entraid_multitenant: bool = False
    app_path: str = ""
    base_dir: Path = Path(__file__).resolve().parent
    object_cache_url: str | None = None
    object_cache_expire_at: str | None = "0 12 * * sat"
    object_cache_enable_compression: bool = True
    cors_allow_origins: list[str] = []
    custom_functions_max_retries: int = 3
    custom_functions_retry_codes: list[int] = [500, 502, 504]
    custom_headers: dict[str, str] = {}
    date_format: str | None = None
    taskpane_html: str = "taskpane.html"
    enable_alpinejs_csp: bool = True
    enable_bootstrap: bool = True
    enable_examples: bool = False
    enable_excel_online: bool = True
    enable_hotreload: bool = True
    enable_htmx: bool = True
    enable_socketio: bool = True
    enable_tests: bool = False
    enable_wasm: bool = False
    environment: Literal["dev", "qa", "uat", "staging", "prod"] = "prod"
    functions_namespace: str = "XLWINGS"
    hostname: str | None = None
    is_official_lite_addin: bool | None = False
    cdn_pyodide: bool = True
    cdn_officejs: bool = False
    log_level: str = "INFO"
    # Manifest UUIDs - loaded from pyproject.toml [tool.xlwings_server] or defaults
    # Run 'xlwings-server init' to generate unique UUIDs in pyproject.toml
    manifest_id_dev: UUID4 = _pyproject_config.get(
        "manifest_id_dev", "0a856eb1-91ab-4f38-b757-23fbe1f73130"
    )
    manifest_id_qa: UUID4 = _pyproject_config.get(
        "manifest_id_qa", "9cda34b1-af68-4dc6-b97c-e63ef6284671"
    )
    manifest_id_uat: UUID4 = _pyproject_config.get(
        "manifest_id_uat", "70428e53-8113-421c-8fe2-9b74fcb94ee5"
    )
    manifest_id_staging: UUID4 = _pyproject_config.get(
        "manifest_id_staging", "34041f4f-9cb4-4830-afb5-db44b2a70e0e"
    )
    manifest_id_prod: UUID4 = _pyproject_config.get(
        "manifest_id_prod", "4f342d85-3a49-41cb-90a5-37b1f2219040"
    )
    project_name: str = "xlwings Server"
    public_addin_store: bool | None = None  # Deprecated. Use cdn_officejs instead.
    request_timeout: int | None = 300  # in seconds
    secret_key: str | None = None
    socketio_message_queue_url: str | None = None
    socketio_server_app: bool = False
    static_url_path: str = "/static"
    license_key: str | None = ""
    xlwings_version: str = xw.__version__

    @computed_field
    @property
    def jsconfig(self) -> dict:
        return {
            "authProviders": self.auth_providers,
            "appPath": self.app_path,
            "xlwingsVersion": self.xlwings_version,
            "onWasm": self.enable_wasm,
            "isOfficialLiteAddin": self.is_official_lite_addin,
            "requestTimeout": self.request_timeout,
            "customFunctionsMaxRetries": self.custom_functions_max_retries,
            "customFunctionsRetryCodes": self.custom_functions_retry_codes,
        }

    @computed_field
    @property
    def project_dir(self) -> Path:
        """Project directory - location of user's custom files"""
        return PROJECT_DIR

    @computed_field
    @property
    def package_dir(self) -> Path:
        """Package directory - location of xlwings-server package files"""
        return PACKAGE_DIR


settings = Settings()

# TODO: refactor once xlwings offers a runtime config
if settings.license_key and not os.getenv("XLWINGS_LICENSE_KEY"):
    os.environ["XLWINGS_LICENSE_KEY"] = settings.license_key

if settings.date_format:
    os.environ["XLWINGS_DATE_FORMAT"] = settings.date_format
