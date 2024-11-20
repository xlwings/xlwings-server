try:
    # PyScript doesn't work with relative imports
    from config import settings
except ImportError:
    from ..config import settings

if settings.enable_examples:
    from .examples import *
