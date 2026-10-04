"""/api/tasks (contracts/rest-api.md § Tasks). GET /api/tasks is the single search-and-filter
endpoint (R-009); PATCH /api/tasks/{id}/status is the only route that changes status (R-005)."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.common.paging import PageParams
from app.db import Db, get_db
from app.deps import current_user
from app.errors import bad_request
from app.modules.tasks import service
from app.modules.tasks.service import TaskFilters

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

Status = Literal["TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED"]
Priority = Literal["LOW", "MEDIUM", "HIGH"]


def _title(v: str) -> str:
    if not v.strip():
        raise ValueError("must not be blank")
    return v


class TaskCreate(BaseModel):
    projectId: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: Priority = "MEDIUM"
    startDate: date | None = None
    dueDate: date | None = None
    assigneeIds: list[int] = Field(default_factory=list)

    _title_ok = field_validator("title")(_title)


class TaskUpdate(BaseModel):
    # Unknown keys are kept so a `status` field can be rejected with a clear message (R-005).
    model_config = ConfigDict(extra="allow")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: Priority | None = None
    startDate: date | None = None
    dueDate: date | None = None

    _title_ok = field_validator("title")(lambda v: v if v is None else _title(v))


class StatusBody(BaseModel):
    status: str


class AssignBody(BaseModel):
    userIds: list[int] = Field(min_length=1)


def filters_from_query(
    projectId: int | None = Query(None), userId: int | None = Query(None),
    status: Status | None = Query(None), priority: Priority | None = Query(None),
    dueDateFrom: date | None = Query(None), dueDateTo: date | None = Query(None),
    title: str | None = Query(None), overdue: bool | None = Query(None),
    sort: str | None = Query(None),
) -> TaskFilters:
    return TaskFilters(project_id=projectId, user_id=userId, status=status, priority=priority,
                       due_date_from=dueDateFrom, due_date_to=dueDateTo, title=title,
                       overdue=overdue, sort=sort)


@router.get("")
def search(filters: TaskFilters = Depends(filters_from_query), params: PageParams = Depends(),
           user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.search_tasks(db, user, filters, params)


@router.get("/assigned-to-me")
def assigned_to_me(filters: TaskFilters = Depends(filters_from_query),
                   params: PageParams = Depends(), user: dict = Depends(current_user),
                   db: Db = Depends(get_db)):
    return service.search_tasks(db, user, filters, params, scope="assigned")


@router.get("/shared-with-me")
def shared_with_me(filters: TaskFilters = Depends(filters_from_query),
                   params: PageParams = Depends(), user: dict = Depends(current_user),
                   db: Db = Depends(get_db)):
    return service.search_tasks(db, user, filters, params, scope="shared")


@router.post("", status_code=201)
def create_task(body: TaskCreate, response: Response, user: dict = Depends(current_user),
                db: Db = Depends(get_db)):
    task = service.create_task(
        db, user, project_id=body.projectId, title=body.title, description=body.description,
        priority=body.priority, start_date=body.startDate, due_date=body.dueDate,
        assignee_ids=body.assigneeIds)
    response.headers["Location"] = f"/api/tasks/{task['taskId']}"
    return task


@router.get("/{task_id}")
def get_task(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.get_task(db, user, task_id)


@router.put("/{task_id}")
def update_task(task_id: int, body: TaskUpdate, user: dict = Depends(current_user),
                db: Db = Depends(get_db)):
    if body.model_extra and "status" in body.model_extra:
        raise bad_request("Status cannot be changed here; use PATCH /api/tasks/{id}/status",
                          status="use PATCH /api/tasks/{id}/status")
    names = {"title": "title", "description": "description", "priority": "priority",
             "startDate": "start_date", "dueDate": "due_date"}
    fields = {names[k]: getattr(body, k) for k in body.model_fields_set if k in names}
    if fields.get("title") is None:
        fields.pop("title", None)
    if fields.get("priority") is None:
        fields.pop("priority", None)
    return service.update_task(db, user, task_id, fields)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    service.delete_task(db, user, task_id)
    return Response(status_code=204)


@router.patch("/{task_id}/status", status_code=204)
def change_status(task_id: int, body: StatusBody, user: dict = Depends(current_user),
                  db: Db = Depends(get_db)):
    service.change_status(db, user, task_id, body.status)
    return Response(status_code=204)


@router.post("/{task_id}/assignees")
def assign(task_id: int, body: AssignBody, user: dict = Depends(current_user),
           db: Db = Depends(get_db)):
    return service.assign(db, user, task_id, body.userIds)


@router.delete("/{task_id}/assignees/{user_id}", status_code=204)
def unassign(task_id: int, user_id: int, user: dict = Depends(current_user),
             db: Db = Depends(get_db)):
    service.unassign(db, user, task_id, user_id)
    return Response(status_code=204)
