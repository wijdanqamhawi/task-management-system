"""POST /api/auth/register | login | logout, GET /api/auth/me (contracts/rest-api.md)."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.config import get_settings
from app.db import Db, get_db
from app.deps import current_user
from app.errors import ApiError
from app import mailer as mail
from app import ratelimit
from app.security import validate_password_policy
from app.modules.auth import reset
from app.modules.users import service
from app import session as session_policy

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("tms.auth")

BAD_CREDENTIALS = "Invalid email or password"   # identical for unknown user, wrong password, inactive


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    fullName: str = Field(min_length=1, max_length=150)
    username: str | None = Field(default=None, min_length=3, max_length=50,
                                 pattern=r"^[A-Za-z0-9._-]+$")

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_policy(v)

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
    remember: bool = False     # "Remember me": 30-day persistent session


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
    settings = get_settings()
    lifetime = settings.remember_days * 86400 if body.remember else settings.session_max_age
    request.session.clear()                 # fresh session on login
    request.session["uid"] = user["user_id"]
    request.session["remember"] = body.remember
    request.session["exp"] = session_policy.now() + lifetime
    request.session["pwf"] = user["pw_fp"]      # ends this session if the password changes
    return service.user_view(user)


@router.post("/logout", status_code=204)
def logout(request: Request, _user: dict = Depends(current_user)):
    request.session.clear()
    return Response(status_code=204)


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return service.user_view(user)


# ----------------------------------------------------------------- password reset

FORGOT_GENERIC = ("If an account exists for that email address, a password reset link will be "
                  "emailed shortly.")
INVALID_LINK = "This password reset link is invalid or has expired."
TOO_MANY = "Too many requests. Please try again later."


class ForgotBody(BaseModel):
    email: EmailStr


class TokenBody(BaseModel):
    token: str = Field(min_length=1, max_length=200)


class ResetBody(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_policy(v)


def _client_ip(request: Request) -> str:
    if get_settings().trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded.strip():
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/forgot-password", status_code=202)
def forgot_password(body: ForgotBody, request: Request, background: BackgroundTasks,
                    db: Db = Depends(get_db), mailer: mail.Mailer = Depends(mail.get_mailer)):
    """Always the same 202 for a well-formed address, whether or not an account exists, so
    the endpoint cannot be used to discover who is registered. The e-mail is sent after the
    response (background task) so timing does not reveal it either."""
    settings = get_settings()
    ip = _client_ip(request)
    if not ratelimit.forgot_ip.allow(ip):
        raise ApiError(429, TOO_MANY)                  # per IP: reveals nothing about accounts
    email = body.email.strip().lower()
    if not ratelimit.forgot_email.allow(email):
        return {"message": FORGOT_GENERIC}             # per address: silently dropped
    if not mailer.configured:
        log.warning("Password reset requested but SMTP is not configured; nothing was sent")
        return {"message": FORGOT_GENERIC}
    issued = reset.issue_token(db, email, settings.reset_token_minutes, ip)
    if issued is not None:
        token, user = issued
        background.add_task(
            mail.deliver, mailer, to=user["email"], full_name=user["full_name"],
            link=mail.reset_link(settings, token), minutes=settings.reset_token_minutes)
    return {"message": FORGOT_GENERIC}


@router.post("/reset-password/validate")
def validate_reset_token(body: TokenBody, request: Request, db: Db = Depends(get_db)):
    """POST (not GET) so the token never appears in a URL, hence never in access logs."""
    ip = _client_ip(request)
    if not ratelimit.reset_failures_ip.available(ip):
        raise ApiError(429, TOO_MANY)
    valid = reset.is_token_valid(db, body.token)
    if not valid:
        ratelimit.reset_failures_ip.hit(ip)
    return {"valid": valid}


@router.post("/reset-password", status_code=204)
def reset_password(body: ResetBody, request: Request, db: Db = Depends(get_db)):
    ip = _client_ip(request)
    if not ratelimit.reset_failures_ip.available(ip):
        raise ApiError(429, TOO_MANY)
    if not reset.reset_password(db, body.token, body.password):
        ratelimit.reset_failures_ip.hit(ip)
        raise ApiError(400, INVALID_LINK)
    return Response(status_code=204)
