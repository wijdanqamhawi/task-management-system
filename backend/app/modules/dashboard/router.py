"""GET /api/dashboard: all nine required figures in one response (FR-036..FR-045).

Computed per request by PKG_DASHBOARD, scoped to the caller's visibility, never cached.
"""
from fastapi import APIRouter, Depends

from app.db import Db, get_db
from app.deps import current_user
from app.modules.dashboard import repository as repo

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user: dict = Depends(current_user), db: Db = Depends(get_db)):
    uid = user["user_id"]
    return {
        **repo.totals(db, uid),
        "tasksByStatus": repo.tasks_by_status(db, uid),
        "tasksByPriority": repo.tasks_by_priority(db, uid),
        "tasksByUser": repo.tasks_by_user(db, uid),
        "projectProgress": repo.project_progress(db, uid),
    }
