import logging
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class BaseUser(BaseModel):
    """
    Base user model. This is set up so that it populates most fields from claims
    as returned by OIDC tokens (e.g., Entra ID). You can also use the model by setting
    the attributes directly though.
    For customization, extend or override the User class below.
    """

    id_: Optional[str] = Field(default=None, alias="id")
    name_: Optional[str] = Field(default=None, alias="name")
    domain_: Optional[str] = Field(default=None, alias="domain")
    email_: Optional[str] = Field(default=None, alias="email")
    roles_: Optional[list[str]] = Field(default=[], alias="roles")
    claims: Optional[Dict[str, Any]] = {}
    ip_address: Optional[str] = None

    @property
    def id(self) -> Optional[str]:
        return self.claims.get("oid", self.id_)

    @id.setter
    def id(self, value: str):
        self.id_ = value

    @property
    def name(self) -> Optional[str]:
        return self.claims.get("name", self.name_)

    @name.setter
    def name(self, value: str):
        self.name_ = value

    @property
    def domain(self) -> Optional[str]:
        return (
            self.email.split("@")[1]
            if self.email and "@" in self.email
            else self.domain_
        )

    @domain.setter
    def domain(self, value: Optional[str]):
        self.domain_ = value

    @property
    def email(self) -> Optional[str]:
        return self.claims.get("preferred_username", self.email_)

    @email.setter
    def email(self, value: Optional[str]):
        self.email_ = value

    @property
    def roles(self) -> list[str]:
        return self.claims.get("roles", self.roles_)

    @roles.setter
    def roles(self, value: list[str]):
        self.roles_ = value

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
        """Method that can be overridden to implement a global authorization logic"""
        return True


class User(BaseUser):
    """
    User model. You can implement additional field, and override properties and methods
    here such as `roles` and `is_authorized`. You can also start from scratch by
    inheriting from BaseModel rather than BaseUser.
    """

    pass


class CurrentUser(User):
    """
    Will deliver the current user when used as type hint in a custom function/script
    """

    pass
