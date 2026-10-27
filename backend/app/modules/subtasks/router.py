"""Progress items (FR-024; stored in the SUBTASKS table and served under /subtasks so existing
clients and data keep working). Two separate permissions, each also bound to a resource rule:

Each item has a required Start and End date/time (startAt, endAt; End must be later than Start).
`progressAt` is a read-only alias of startAt kept for older clients; it is rejected on input.
Rows that predate migration 003 may have no End (NULL) until a manager edits them.

* PROGRESS_MANAGE (create, edit, delete) - ADMIN, or a MANAGER who is a member of the task's project.
* PROGRESS_TOGGLE (completed / incomplete) - the same managers, or a user assigned to THIS task.
  The toggle has its own endpoint that accepts nothing but `isCompleted`, so a toggle can never
  change the title, date or time.

Viewing needs only visibility of the task. A task outside the caller's projects is a 404.
A parent task may reach COMPLETED while items are open: nothing here ties the two (R-015)."""
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator

from app.common.access import is_assignee, is_project_manager, require_project_manager, require_task_visible
from app.common.permissions import PROGRESS_MANAGE, PROGRESS_TOGGLE, has_permission
from app.db import Db, get_db
from app.deps import current_user
from app.errors import bad_request, forbidden, not_found

router = APIRouter(tags=["subtasks"])


def _naive(v: datetime | None) -> datetime | None:
    """The column is a plain TIMESTAMP: the date and time are stored exactly as entered."""
    return v.replace(tzinfo=None, microsecond=0) if v is not None else None


def _check_order(start: datetime | None, end: datetime | None) -> None:
    if start is not None and end is not None and end <= start:
        raise bad_request("End date & time must be later than Start date & time",
                          endAt="must be later than the start date and time")


class ProgressCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    startAt: datetime
    endAt: datetime
    sortOrder: int = Field(default=0, ge=0, le=9999)

    @field_validator("title")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v

    @field_validator("startAt", "endAt")
    @classmethod
    def _no_tz(cls, v):
        return _naive(v)

    @model_validator(mode="after")
    def _end_after_start(self):
        if self.endAt <= self.startAt:
            raise ValueError("endAt must be later than startAt")
        return self


class ProgressUpdate(BaseModel):
    """Details only. Completion is changed through /completion, never here."""
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    startAt: datetime | None = None
    endAt: datetime | None = None
    sortOrder: int | None = Field(default=None, ge=0, le=9999)

    @field_validator("title")
    @classmethod
    def _not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("must not be blank")
        return v

    @field_validator("startAt", "endAt")
    @classmethod
    def _no_tz(cls, v):
        return _naive(v)


class CompletionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")      # title / date / time are rejected with 400
    isCompleted: StrictBool


def _view(r: dict) -> dict:
    return {"subtaskId": r["subtask_id"], "taskId": r["task_id"], "title": r["title"],
            "isCompleted": r["is_completed"], "sortOrder": r["sort_order"],
            "startAt": r["start_at"], "endAt": r["end_at"],
            "progressAt": r["start_at"],        # read-only alias of startAt (older clients)
            "createdAt": r["created_at"]}


_COLS = "subtask_id, task_id, title, is_completed, sort_order, start_at, end_at, created_at"


def _load(db: Db, user: dict, subtask_id: int) -> tuple[dict, dict]:
    """The item and its task (the task carries project_id). 404 if the task is not visible."""
    row = db.one(f"SELECT {_COLS} FROM subtasks WHERE subtask_id = :id", {"id": subtask_id})
    if row is None:
        raise not_found("Progress item not found")
    return row, require_task_visible(db, user, row["task_id"])


def _may_manage(db: Db, user: dict, project_id: int) -> None:
    require_project_manager(db, user, project_id, PROGRESS_MANAGE)      # 403 if not


@router.get("/api/tasks/{task_id}/subtasks")
def list_progress(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_task_visible(db, user, task_id)
    rows = db.query(f"SELECT {_COLS} FROM subtasks WHERE task_id = :t "
                    f"ORDER BY start_at NULLS LAST, sort_order, subtask_id", {"t": task_id})
    return [_view(r) for r in rows]


@router.post("/api/tasks/{task_id}/subtasks", status_code=201)
def create_progress(task_id: int, body: ProgressCreate, response: Response,
                    user: dict = Depends(current_user), db: Db = Depends(get_db)):
    task = require_task_visible(db, user, task_id)
    _may_manage(db, user, task["project_id"])
    new_id = db.insert(
        "INSERT INTO subtasks (task_id, title, sort_order, start_at, end_at) "
        "VALUES (:t, :title, :o, :s, :e)",
        {"t": task_id, "title": body.title.strip(), "o": body.sortOrder,
         "s": body.startAt, "e": body.endAt},
        "subtask_id")
    db.commit()
    response.headers["Location"] = f"/api/subtasks/{new_id}"
    return _view(_load(db, user, new_id)[0])


@router.put("/api/subtasks/{subtask_id}")
def update_progress(subtask_id: int, body: ProgressUpdate, user: dict = Depends(current_user),
                    db: Db = Depends(get_db)):
    row, task = _load(db, user, subtask_id)
    _may_manage(db, user, task["project_id"])
    title = body.title.strip() if body.title is not None else row["title"]
    start = body.startAt if body.startAt is not None else row["start_at"]
    end = body.endAt if body.endAt is not None else row["end_at"]
    _check_order(start, end)
    order = row["sort_order"] if body.sortOrder is None else body.sortOrder
    db.execute(
        "UPDATE subtasks SET title = :title, start_at = :s, end_at = :e, sort_order = :o "
        "WHERE subtask_id = :id",
        {"title": title, "s": start, "e": end, "o": order, "id": subtask_id})
    db.commit()
    return _view(_load(db, user, subtask_id)[0])


@router.put("/api/subtasks/{subtask_id}/completion")
def set_completion(subtask_id: int, body: CompletionBody, user: dict = Depends(current_user),
                   db: Db = Depends(get_db)):
    row, task = _load(db, user, subtask_id)
    allowed = has_permission(user, PROGRESS_TOGGLE) and (
        is_project_manager(db, user, task["project_id"], PROGRESS_MANAGE)
        or is_assignee(db, task["task_id"], user["user_id"]))
    if not allowed:
        raise forbidden()
    db.execute("UPDATE subtasks SET is_completed = :c WHERE subtask_id = :id",
               {"c": "Y" if body.isCompleted else "N", "id": subtask_id})
    db.commit()
    return _view(_load(db, user, subtask_id)[0])


@router.delete("/api/subtasks/{subtask_id}", status_code=204)
def delete_progress(subtask_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    _, task = _load(db, user, subtask_id)
    _may_manage(db, user, task["project_id"])
    db.execute("DELETE FROM subtasks WHERE subtask_id = :id", {"id": subtask_id})
    db.commit()
    return Response(status_code=204)
