"""/api/recycle-bin (contracts/rest-api.md § Recycle Bin). Read and restore only: there is no
endpoint that permanently deletes a task."""
from fastapi import APIRouter, Depends, Query

from app.common.paging import PageParams
from app.db import Db, get_db
from app.deps import current_user
from app.modules.recycle_bin import service

router = APIRouter(prefix="/api/recycle-bin", tags=["recycle-bin"])


@router.get("/tasks")
def list_deleted(params: PageParams = Depends(), search: str | None = Query(None, max_length=200),
                 projectId: int | None = Query(None), sort: str | None = Query(None),
                 user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.list_deleted(db, user, params, search=search, project_id=projectId, sort=sort)


@router.post("/tasks/{task_id}/restore")
def restore_task(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.restore_task(db, user, task_id)
