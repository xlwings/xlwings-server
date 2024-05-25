from fastapi import APIRouter, Depends

from ...dependencies import get_user

router = APIRouter(dependencies=[Depends(get_user)])
