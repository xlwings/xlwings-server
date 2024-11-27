try:
    from ..config import settings
except ImportError:
    # PyScript doesn't work with parent relative imports
    from config import settings

if settings.enable_examples:
    from .examples import *
