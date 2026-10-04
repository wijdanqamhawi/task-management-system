"""/api/users (contracts/rest-api.md § Users)."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr, Field

from app.common.paging import PageParams
from app.db import Db, get_db
from app.deps import ADMIN, current_user, require_roles
from app.modules.users import service

router = APIRouter(prefix="/api/users", tags=["users"])


class ProfileBody(BaseModel):
    fullName: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None


class RoleBody(BaseModel):
    role: Literal["ADMIN", "MANAGER", "MEMBER"]


@router.get("")
def list_users(search: str | None = Query(None), params: PageParams = Depends(),
               _user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.list_users(db, params, search)


@router.put("/me")
def update_me(body: ProfileBody, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.update_profile(db, user, full_name=body.fullName, email=body.email)


@router.get("/{user_id}")
def get_user(user_id: int, _user: dict = Depends(current_user), db: Db = Depends(get_db)):
    return service.get_user(db, user_id)


@router.put("/{user_id}/role")
def set_role(user_id: int, body: RoleBody, admin: dict = Depends(require_roles(ADMIN)),
             db: Db = Depends(get_db)):
    return service.set_role(db, admin, user_id, body.role)


@router.put("/{user_id}/activate")
def activate(user_id: int, admin: dict = Depends(require_roles(ADMIN)), db: Db = Depends(get_db)):
    return service.set_active(db, admin, user_id, True)


@router.put("/{user_id}/deactivate")
def deactivate(user_id: int, admin: dict = Depends(require_roles(ADMIN)),
               db: Db = Depends(get_db)):
    return service.set_active(db, admin, user_id, False)
