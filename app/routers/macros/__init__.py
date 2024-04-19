from ...config import settings
from .router import router

if settings.enable_examples:
    from . import examples
