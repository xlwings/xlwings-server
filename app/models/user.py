import logging
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class BaseUser(BaseModel):
    """
    Base model for user handling.
    For customization, extend or override the User class.
    """

    id: str
    name: str
    email: Optional[str] = None
    domain: Optional[str] = None
    roles_: Optional[list[str]] = Field(default=[], alias="roles")
    ip_address: Optional[str] = None

    @property
    def roles(self) -> list[str]:
        """
        Property that can be overridden to implement custom role retrieval logic.
        By default, returns the roles from the authentication provider.
        """
        return self.roles_

    @roles.setter
    def roles(self, value: list[str]):
        self.roles_ = value

    async def has_required_roles(self, required_roles: Optional[list[str]] = None):
        print(self.roles)
        if required_roles:
            if set(required_roles).issubset(self.roles):
                logger.info(f"User has required roles: {self.name}")
                return True
            else:
                return False
        else:
            return True

    async def is_authorized(self):
        """Method that can be overridden to implement a global authorization logic"""
        return True


class User(BaseUser):
    """
    User model. You can implement additional fields, and override properties and methods
    here such as `roles` and `is_authorized`.
    """

    pass


class CurrentUser(User):
    """
    Will deliver the current user when used as type hint in a custom function/script
    """

    pass
