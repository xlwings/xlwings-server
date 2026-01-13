import logging
from typing import Any

from pydantic import BaseModel, Field, model_validator

try:
    from typing import Self
except ImportError:
    # Python < 3.11
    from typing_extensions import Self

logger = logging.getLogger(__name__)


class User(BaseModel):
    """
    User model. This is set up so that it populates most fields from claims
    as returned by OIDC tokens (e.g., Entra ID). You can also use the model by setting
    the attributes directly though.
    """

    id: str | None = None
    name: str | None = None
    domain: str | None = None
    email: str | None = None
    roles: list[str] = []
    ip_address: str | None = None
    claims: dict[str, Any] = Field({}, repr=False)

    @model_validator(mode="after")
    def populate_from_claims(self) -> Self:
        if self.claims:
            self.id = self.id or self.claims.get("oid")
            self.name = self.name or self.claims.get("name")
            self.email = self.email or self.claims.get("preferred_username")
            self.roles = self.roles or self.claims.get("roles", [])
            if not self.domain and self.email and "@" in self.email:
                self.domain = self.email.split("@")[1]
        return self

    async def has_required_roles(self, required_roles: list[str] | None = None):
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
