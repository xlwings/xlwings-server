import logging
import os
import sys
import warnings
from importlib.metadata import version as get_package_version
from pathlib import Path
from typing import Any, Literal

from pydantic import UUID4, computed_field
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    PyprojectTomlConfigSettingsSource,
    SettingsConfigDict,
)

logger = logging.getLogger(__name__)

# Set before xlwings is imported elsewhere in the application
os.environ["XLWINGS_ON_SERVER"] = "true"

# Get project directory from environment (set by CLI)
# Falls back to current working directory if not set (for backward compatibility)
PROJECT_DIR = Path(os.getenv("XLWINGS_PROJECT_DIR", Path.cwd()))

# Get package directory - must be calculated before any sys.path manipulation
# Use __file__ which points to the actual config.py location (in site-packages after install)
PACKAGE_DIR = Path(__file__).parent.resolve()

# Setup sys.path for user overrides
# This is also done in main.py, but we need it here too because config.py
# can be imported directly (e.g., from custom_functions) before main.py runs
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

# Settings prefix used for environment variables (required)
# and pyproject.toml keys (optional)
ENV_PREFIX = "XLWINGS_"


class CaseInsensitivePyprojectTomlSource(PyprojectTomlConfigSettingsSource):
    """
    PyprojectToml source that handles case-insensitive keys and strips ENV_PREFIX.
    E.g., allows 'environment', 'ENVIRONMENT', 'XLWINGS_ENVIRONMENT', etc. to all work.
    """

    def __call__(self) -> dict[str, Any]:
        config = super().__call__()
        normalized = {}
        prefix_lower = ENV_PREFIX.lower()
        for k, v in config.items():
            # Convert to lowercase
            key = k.lower()
            # Strip prefix if present (e.g., "xlwings_")
            if key.startswith(prefix_lower):
                key = key[len(prefix_lower) :]
            normalized[key] = v
        return normalized


class Settings(BaseSettings):
    """
    xlwings Server settings with support for multiple configuration sources.

    Configuration priority (highest to lowest):
    1. Environment variables (XLWINGS_*)
    2. .env file
    3. pyproject.toml [tool.xlwings_server] section
    4. Default values defined in this class

    See .env.template for detailed documentation of all settings.
    """

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
        env_prefix=ENV_PREFIX,
        env_file=os.getenv("DOTENV_PATH", PROJECT_DIR / ".env"),
        extra="ignore",
        pyproject_toml_table_header=("tool", "xlwings_server"),
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        """
        Define the sources and their priority order.
        Priority (highest to lowest):
        1. init_settings - arguments passed to Settings()
        2. env_settings - environment variables
        3. dotenv_settings - .env file
        4. pyproject.toml - [tool.xlwings_server] section
        5. file_secret_settings - secret files
        """
        # CaseInsensitivePyprojectTomlSource looks in PROJECT_DIR for pyproject.toml
        pyproject_path = PROJECT_DIR / "pyproject.toml"
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            CaseInsensitivePyprojectTomlSource(
                settings_cls, pyproject_path if pyproject_path.exists() else None
            ),
            file_secret_settings,
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
    manifest_id_dev: UUID4 = "0a856eb1-91ab-4f38-b757-23fbe1f73130"
    manifest_id_qa: UUID4 = "9cda34b1-af68-4dc6-b97c-e63ef6284671"
    manifest_id_uat: UUID4 = "70428e53-8113-421c-8fe2-9b74fcb94ee5"
    manifest_id_staging: UUID4 = "34041f4f-9cb4-4830-afb5-db44b2a70e0e"
    manifest_id_prod: UUID4 = "4f342d85-3a49-41cb-90a5-37b1f2219040"
    project_name: str = "xlwings Server"
    public_addin_store: bool | None = None  # Deprecated. Use cdn_officejs instead.
    request_timeout: int | None = 300  # in seconds
    secret_key: str | None = None
    socketio_message_queue_url: str | None = None
    socketio_server_app: bool = False
    static_url_path: str = "/static"
    license_key: str | None = ""
    xlwings_version: str = get_package_version("xlwings")

    @computed_field
    @property
    def jsconfig(self) -> dict:
        return {
            "appPath": self.app_path,
            "authProviders": self.auth_providers,
            "customFunctionsMaxRetries": self.custom_functions_max_retries,
            "customFunctionsRetryCodes": self.custom_functions_retry_codes,
            "environment": self.environment,
            "isOfficialLiteAddin": self.is_official_lite_addin,
            "onWasm": self.enable_wasm,
            "requestTimeout": self.request_timeout,
            "xlwingsVersion": self.xlwings_version,
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


# Try to import Settings from project directory (user override)
# Fall back to package Settings if not found
def _create_settings() -> Settings:
    """Create settings instance, checking for project-level config override"""
    try:
        config_file = PROJECT_DIR / "config.py"
        if config_file.exists():
            # Import Settings from project config
            import importlib

            config_module = importlib.import_module("config")
            if hasattr(config_module, "Settings"):
                ProjectSettings = config_module.Settings
                logger.info("Loaded settings from project config.py")
                return ProjectSettings()
    except Exception as e:
        logger.debug(f"No project config.py found or failed to load: {e}")

    # No project config or import failed, use package Settings
    return Settings()


settings = _create_settings()

# TODO: refactor once xlwings offers a runtime config
if settings.license_key and not os.getenv("XLWINGS_LICENSE_KEY"):
    os.environ["XLWINGS_LICENSE_KEY"] = settings.license_key

if settings.date_format:
    os.environ["XLWINGS_DATE_FORMAT"] = settings.date_format
