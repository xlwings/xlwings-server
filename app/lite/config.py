import os

from dotenv import load_dotenv

load_dotenv(".env")


class Settings:
    enable_examples: bool = (
        os.getenv("XLWINGS_ENABLE_EXAMPLES", "true").lower() == "true"
    )
    environment: str = os.getenv("XLWINGS_ENVIRONMENT", "prod")
    functions_namespace: str = os.getenv("XLWINGS_FUNCTIONS_NAMESPACE", "XLWINGS")


settings = Settings()
