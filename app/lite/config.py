import os

from dotenv import load_dotenv

load_dotenv(".env")


def read_bool(env_name: str, default: str = "true") -> bool:
    return os.getenv(env_name, default).lower() == "true"


class Settings:
    enable_examples: bool = read_bool("XLWINGS_ENABLE_EXAMPLES")
    enable_lite: bool = True
    enable_tests: bool = read_bool("XLWINGS_ENABLE_TESTS")
    environment: str = os.getenv("XLWINGS_ENVIRONMENT", "prod")
    functions_namespace: str = os.getenv("XLWINGS_FUNCTIONS_NAMESPACE", "XLWINGS")


settings = Settings()
