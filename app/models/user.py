import logging
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class User(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    domain: Optional[str] = None
    roles: Optional[list[str]] = []

    async def has_required_roles(self, required_roles: Optional[list[str]] = None):
        if required_roles:
            if set(required_roles).issubset(self.roles):
                logger.info(f"User has required roles: {self.name}")
                return True
            else:
                return False
        else:
            return True

    async def is_authorized(self):
        """Here, you can implement a custom authorization logic"""
        return True


class CurrentUser(User):
    """
    Will deliver the current user when used as type hint in a custom function/script
    """

    pass
