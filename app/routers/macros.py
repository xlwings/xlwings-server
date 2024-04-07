import logging

from fastapi import APIRouter, Depends

from ..auth.entraid import User, get_user  # noqa: F401
from ..dependencies import Book  # noqa: F401

logger = logging.getLogger(__name__)


router = APIRouter(dependencies=[Depends(get_user)])
