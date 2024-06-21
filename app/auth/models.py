from typing import List, Optional

from pydantic import BaseModel


class User(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    roles: Optional[List[str]] = []
