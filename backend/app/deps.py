"""Authentication and role dependencies (FR-002, FR-005, FR-007, Constitution V).

The session cookie only carries the user id. The user is re-read from USERS on EVERY request,
so deactivating an account takes effect on that user's very next request even though their
cookie is still validly signed (FR-007, SC-008).
"""
from fastapi import Depends, Request

from app.db import Db, get_db
from app.errors import forbidden, unauthorized

ADMIN, MANAGER, MEMBER = "ADMIN", "MANAGER", "MEMBER"

_USER_SQL = """
    SELECT u.user_id, u.username, u.email, u.full_name, u.is_active, u.created_at,
           r.role_name AS role
      FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = :user_id
"""


def load_user(db: Db, user_id: int) -> dict | None:
    return db.one(_USER_SQL, {"user_id": user_id})


def current_user(request: Request, db: Db = Depends(get_db)) -> dict:
    user_id = request.session.get("uid")
    if user_id is None:
        raise unauthorized()
    user = load_user(db, user_id)
    if user is None or not user["is_active"]:
        request.session.clear()
        raise unauthorized()
    return user


def require_roles(*roles: str):
    """Coarse, role-only capability check (research.md R-003, layer 1)."""
    def dependency(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise forbidden()
        return user
    return dependency
