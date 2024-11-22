import os

from dotenv import load_dotenv

load_dotenv(".env")


class Settings:
    enable_examples: bool = (
        os.getenv("XLWINGS_ENABLE_EXAMPLES", "true").lower() == "true"
    )


settings = Settings()
