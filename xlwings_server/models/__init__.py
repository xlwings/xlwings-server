from xlwings.server import register_injectable_typehint

from .caller import Caller, caller_from_address, parse_caller_address  # noqa: F401

# Try to import User model from project directory first (user override)
# Fall back to package location (default implementation)
try:
    from models.user import User
except ModuleNotFoundError:
    from .user import User


class CurrentUser(User):
    """
    Will deliver the current user when used as type hint in a custom function/script
    """

    pass


# Tell xlwings that CurrentUser is provided by the framework rather than by Excel, so
# that it's hidden from the Excel-facing signature and can be placed in any position,
# including keyword-only, i.e. after *args.
register_injectable_typehint(CurrentUser)
