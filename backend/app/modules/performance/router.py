"""/api/performance: schedule and completion figures per user (see service.py)."""
from fastapi import APIRouter, Depends

from app.db import Db, get_db
from app.deps import current_user
from app.modules.performance import service

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/me")
def my_performance(user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.user_performance(db, user, user["user_id"])


@router.get("/users/{user_id}")
def user_performance(user_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.user_performance(db, user, user_id)
