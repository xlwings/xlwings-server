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

    def authorize(self, roles: list = None):
        if roles:
            if set(roles).issubset(self.roles):
                logger.info(f"User authorized: {self.name}")
                return True, ""
            else:
                return (
                    False,
                    f"Auth error: Missing roles for {self.name}: {', '.join(set(roles).difference(self.roles))}",
                )
        else:
            return True, ""
