"""POST /api/auth/register | login | logout, GET /api/auth/me (contracts/rest-api.md)."""
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.db import Db, get_db
from app.deps import current_user
from app.errors import ApiError
from app.modules.users import service

router = APIRouter(prefix="/api/auth", tags=["auth"])

BAD_CREDENTIALS = "Invalid email or password"   # identical for unknown user, wrong password, inactive


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    fullName: str = Field(min_length=1, max_length=150)
    username: str | None = Field(default=None, min_length=3, max_length=50,
                                 pattern=r"^[A-Za-z0-9._-]+$")

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("must be at most 72 bytes")
        return v

    @field_validator("fullName")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be blank")
        return v


class LoginBody(BaseModel):
    # The frontend sends `email`; `username` is accepted as an alternative identifier.
    email: str | None = None
    username: str | None = None
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterBody, response: Response, db: Db = Depends(get_db)):
    user = service.register(db, email=body.email, password=body.password,
                            full_name=body.fullName, username=body.username)
    response.headers["Location"] = f"/api/users/{user['userId']}"
    return user


@router.post("/login")
def login(body: LoginBody, request: Request, db: Db = Depends(get_db)):
    identifier = body.email or body.username
    if not identifier:
        raise ApiError(401, BAD_CREDENTIALS)
    user = service.authenticate(db, identifier, body.password)
    if user is None:
        raise ApiError(401, BAD_CREDENTIALS)
    request.session.clear()                 # fresh session on login
    request.session["uid"] = user["user_id"]
    return service.user_view(user)


@router.post("/logout", status_code=204)
def logout(request: Request, _user: dict = Depends(current_user)):
    request.session.clear()
    return Response(status_code=204)


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return service.user_view(user)
