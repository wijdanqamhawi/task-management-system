"""Authentication and role dependencies (FR-002, FR-005, FR-007, Constitution V).

The session cookie only carries the user id. The user is re-read from USERS on EVERY request,
so deactivating an account takes effect on that user's very next request even though their
cookie is still validly signed (FR-007, SC-008).
"""
import logging

from fastapi import Depends, Request

from app.common.permissions import ALL_PERMISSIONS, has_permission
from app.db import Db, get_db
from app.errors import forbidden, unauthorized
from app import session as session_policy

log = logging.getLogger("tms.deps")

ADMIN, MANAGER, MEMBER = "ADMIN", "MANAGER", "MEMBER"

# Effective permissions = the grants of the user's role (RBAC, database/ddl/09_rbac.sql).
_PERMISSIONS_SQL = """
    SELECT p.permission_code
      FROM users u
      JOIN role_permissions rp ON rp.role_id = u.role_id
      JOIN permissions p       ON p.permission_id = rp.permission_id
     WHERE u.user_id = :user_id
"""

_USER_SQL = """
    SELECT u.user_id, u.username, u.email, u.full_name, u.is_active, u.created_at,
           r.role_name AS role,
           -- fingerprint of the current password hash; never the hash itself
           SUBSTR(LOWER(RAWTOHEX(STANDARD_HASH(u.password_hash, 'SHA256'))), 1, 32) AS pw_fp
      FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.user_id = :user_id
"""


def load_user(db: Db, user_id: int) -> dict | None:
    return db.one(_USER_SQL, {"user_id": user_id})


def load_permissions(db: Db, user_id: int) -> frozenset[str]:
    return frozenset(r["permission_code"] for r in db.query(_PERMISSIONS_SQL, {"user_id": user_id}))


def current_user(request: Request, db: Db = Depends(get_db)) -> dict:
    user_id = request.session.get("uid")
    if user_id is None:
        raise unauthorized()
    # The server enforces the session lifetime (8 h, or 30 days with "Remember me"); a cookie
    # without `exp` predates this rule and is treated as expired.
    exp = request.session.get("exp")
    if not isinstance(exp, int) or exp <= session_policy.now():
        request.session.clear()
        raise unauthorized()
    user = load_user(db, user_id)
    if user is None or not user["is_active"]:
        request.session.clear()
        raise unauthorized()
    # A password reset (or any password change) ends every session issued before it: the
    # session carries the fingerprint of the password it was created with.
    if request.session.get("pwf") != user["pw_fp"]:
        request.session.clear()
        raise unauthorized()
    # Re-read on every request like the role, so a changed grant applies on the next request.
    user["permissions"] = load_permissions(db, user_id)
    return user


def require_permission(code: str):
    """Global capability check (RBAC). Fails closed: an unknown code is always refused. Resource
    rules (membership, assignee, ownership) are NOT implied and still apply in the service."""
    if code not in ALL_PERMISSIONS:
        log.error("require_permission(%r): unknown permission code; every request will be refused",
                  code)

    def dependency(user: dict = Depends(current_user)) -> dict:
        if not has_permission(user, code):
            raise forbidden()
        return user
    return dependency


def require_roles(*roles: str):
    """Coarse, role-only capability check (research.md R-003, layer 1)."""
    def dependency(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise forbidden()
        return user
    return dependency
