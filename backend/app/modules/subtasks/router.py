"""Subtasks (FR-024). Any member of the task's project may manage them. A parent task may reach
COMPLETED while subtasks are open: nothing here (or in the database) ties the two (R-015)."""
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, field_validator

from app.common.access import require_task_visible
from app.db import Db, get_db
from app.deps import current_user
from app.errors import not_found

router = APIRouter(tags=["subtasks"])


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    sortOrder: int = Field(default=0, ge=0, le=9999)

    @field_validator("title")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    isCompleted: bool | None = None
    sortOrder: int | None = Field(default=None, ge=0, le=9999)


def _view(r: dict) -> dict:
    return {"subtaskId": r["subtask_id"], "taskId": r["task_id"], "title": r["title"],
            "isCompleted": r["is_completed"], "sortOrder": r["sort_order"],
            "createdAt": r["created_at"]}


_COLS = "subtask_id, task_id, title, is_completed, sort_order, created_at"


def _load(db: Db, user: dict, subtask_id: int) -> dict:
    row = db.one(f"SELECT {_COLS} FROM subtasks WHERE subtask_id = :id", {"id": subtask_id})
    if row is None:
        raise not_found("Subtask not found")
    require_task_visible(db, user, row["task_id"])       # 404 if the task is not visible
    return row


@router.get("/api/tasks/{task_id}/subtasks")
def list_subtasks(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_task_visible(db, user, task_id)
    rows = db.query(f"SELECT {_COLS} FROM subtasks WHERE task_id = :t "
                    f"ORDER BY sort_order, subtask_id", {"t": task_id})
    return [_view(r) for r in rows]


@router.post("/api/tasks/{task_id}/subtasks", status_code=201)
def create_subtask(task_id: int, body: SubtaskCreate, response: Response,
                   user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_task_visible(db, user, task_id)
    new_id = db.insert(
        "INSERT INTO subtasks (task_id, title, sort_order) VALUES (:t, :title, :o)",
        {"t": task_id, "title": body.title.strip(), "o": body.sortOrder}, "subtask_id")
    db.commit()
    response.headers["Location"] = f"/api/subtasks/{new_id}"
    return _view(_load(db, user, new_id))


@router.put("/api/subtasks/{subtask_id}")
def update_subtask(subtask_id: int, body: SubtaskUpdate, user: dict = Depends(current_user),
                   db: Db = Depends(get_db)):
    row = _load(db, user, subtask_id)
    title = body.title.strip() if body.title is not None else row["title"]
    completed = row["is_completed"] if body.isCompleted is None else body.isCompleted
    order = row["sort_order"] if body.sortOrder is None else body.sortOrder
    db.execute(
        "UPDATE subtasks SET title = :title, is_completed = :c, sort_order = :o "
        "WHERE subtask_id = :id",
        {"title": title, "c": "Y" if completed else "N", "o": order, "id": subtask_id})
    db.commit()
    return _view(_load(db, user, subtask_id))


@router.delete("/api/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    _load(db, user, subtask_id)
    db.execute("DELETE FROM subtasks WHERE subtask_id = :id", {"id": subtask_id})
    db.commit()
    return Response(status_code=204)
