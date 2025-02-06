try:
    from ..config import settings
except ImportError:
    # xlwings Lite
    from config import settings


if settings.enable_examples:
    from .examples import *
