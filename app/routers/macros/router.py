from fastapi import APIRouter, Depends

from ...auth.entraid import get_user

router = APIRouter(dependencies=[Depends(get_user)])
