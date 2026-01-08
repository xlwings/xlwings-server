# Try to import User model from project directory first (user override)
# Fall back to package location (default implementation)
try:
    from models.user import User

    class CurrentUser(User):
        """
        Will deliver the current user when used as type hint in a custom function/script
        """

        pass

except ModuleNotFoundError:
    from .user import CurrentUser, User
