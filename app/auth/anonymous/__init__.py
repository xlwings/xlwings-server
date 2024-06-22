from ..models import User


async def validate_token(token_string=""):
    return User(id="n/a", name="Anonymous")
