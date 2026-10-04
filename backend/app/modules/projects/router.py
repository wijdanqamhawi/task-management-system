"""/api/projects (contracts/rest-api.md § Projects)."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, field_validator

from app.common.access import require_project_visible
from app.common.paging import PageParams
from app.db import Db, get_db
from app.deps import ADMIN, MANAGER, current_user, require_roles
from app.modules.projects import service

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectBody(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    status: Literal["PLANNED", "ACTIVE", "COMPLETED"] = "PLANNED"
    startDate: date | None = None
    endDate: date | None = None

    @field_validator("name")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v


class MemberBody(BaseModel):
    userId: int


def _fields(body: ProjectBody) -> dict:
    return dict(name=body.name, description=body.description, status=body.status,
                start_date=body.startDate, end_date=body.endDate)


@router.get("")
def list_projects(params: PageParams = Depends(), user: dict = Depends(current_user),
                  db: Db = Depends(get_db)):
    return service.list_projects(db, user, params)


@router.post("", status_code=201)
def create_project(body: ProjectBody, response: Response,
                   user: dict = Depends(require_roles(MANAGER, ADMIN)), db: Db = Depends(get_db)):
    project = service.create_project(db, user, **_fields(body))
    response.headers["Location"] = f"/api/projects/{project['projectId']}"
    return project


@router.get("/{project_id}")
def get_project(project_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.get_project(db, user, project_id)


@router.put("/{project_id}")
def update_project(project_id: int, body: ProjectBody, user: dict = Depends(current_user),
                   db: Db = Depends(get_db)):
    return service.update_project(db, user, project_id, **_fields(body))


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    service.delete_project(db, user, project_id)
    return Response(status_code=204)


@router.get("/{project_id}/members")
def list_members(project_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_project_visible(db, user, project_id)
    return service.list_members(db, project_id)


@router.post("/{project_id}/members", status_code=201)
def add_member(project_id: int, body: MemberBody, user: dict = Depends(current_user),
               db: Db = Depends(get_db)):
    return service.add_member(db, user, project_id, body.userId)


@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: int, user_id: int, user: dict = Depends(current_user),
                  db: Db = Depends(get_db)):
    return service.remove_member(db, user, project_id, user_id)


@router.get("/{project_id}/progress")
def progress(project_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.progress(db, user, project_id)
