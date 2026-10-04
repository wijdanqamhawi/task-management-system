"""User accounts: registration, profile, roles, activation (FR-001..FR-008c)."""
import re

from app.common.paging import PageParams, page_response
from app.db import Db, is_unique_violation, violated_constraint
from app.deps import load_user
from app.errors import bad_request, conflict, not_found
from app.security import hash_password, verify_password

_USER_COLUMNS = """u.user_id, u.username, u.email, u.full_name, u.is_active, u.created_at,
                   r.role_name AS role"""


def user_view(row: dict) -> dict:
    return {
        "userId": row["user_id"],
        "username": row["username"],
        "email": row["email"],
        "fullName": row["full_name"],
        "role": row["role"],
        "isActive": row["is_active"],
        "createdAt": row["created_at"],
    }


def _derive_username(db: Db, email: str) -> str:
    base = re.sub(r"[^a-z0-9._-]", "", email.split("@")[0].lower())[:40] or "user"
    candidate, n = base, 1
    while db.scalar("SELECT COUNT(*) FROM users WHERE LOWER(username) = :u", {"u": candidate}):
        n += 1
        candidate = f"{base}{n}"
    return candidate


def register(db: Db, *, email: str, password: str, full_name: str,
             username: str | None) -> dict:
    email = email.strip()
    if db.scalar("SELECT COUNT(*) FROM users WHERE LOWER(email) = :e", {"e": email.lower()}):
        raise conflict("That email address is already registered")
    if username:
        if db.scalar("SELECT COUNT(*) FROM users WHERE LOWER(username) = :u",
                     {"u": username.lower()}):
            raise conflict("That username is already taken")
    else:
        username = _derive_username(db, email)
    try:
        # FR-008 [CLARIFIED]: new accounts are MEMBER and active.
        member_role_id = db.scalar("SELECT role_id FROM roles WHERE role_name = 'MEMBER'")
        user_id = db.insert(
            """INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
               VALUES (:username, :email, :password_hash, :full_name, :role_id, 'Y')""",
            {"username": username, "email": email, "password_hash": hash_password(password),
             "full_name": full_name.strip(), "role_id": member_role_id},
            "user_id")
    except Exception as exc:       # lost a race on the unique constraints
        if is_unique_violation(exc):
            raise conflict("That email address or username is already registered")
        raise
    db.commit()
    return user_view(load_user(db, user_id))


def authenticate(db: Db, identifier: str, password: str) -> dict | None:
    """Return the user for valid credentials of an ACTIVE account, else None. The caller
    gives the same 401 message either way (US1 scenario 2, FR-007)."""
    ident = identifier.strip().lower()
    row = db.one(
        "SELECT user_id, password_hash, is_active FROM users "
        "WHERE LOWER(email) = :i OR LOWER(username) = :i", {"i": ident})
    ok = verify_password(password, row["password_hash"] if row else None)
    if not row or not ok or not row["is_active"]:
        return None
    return load_user(db, row["user_id"])


def list_users(db: Db, params: PageParams, search: str | None) -> dict:
    where, binds = "1 = 1", {}
    if search and search.strip():
        where = ("(UPPER(u.full_name) LIKE :q OR UPPER(u.username) LIKE :q "
                 "OR UPPER(u.email) LIKE :q)")
        binds["q"] = f"%{search.strip().upper()}%"
    total = db.scalar(f"SELECT COUNT(*) FROM users u WHERE {where}", binds)
    rows = db.query(
        f"""SELECT {_USER_COLUMNS} FROM users u JOIN roles r ON r.role_id = u.role_id
             WHERE {where} ORDER BY u.full_name, u.user_id
            OFFSET :off ROWS FETCH NEXT :sz ROWS ONLY""",
        {**binds, "off": params.offset, "sz": params.size})
    return page_response([user_view(r) for r in rows], params, total)


def get_user(db: Db, user_id: int) -> dict:
    row = load_user(db, user_id)
    if row is None:
        raise not_found("User not found")
    return user_view(row)


def update_profile(db: Db, user: dict, *, full_name: str | None, email: str | None) -> dict:
    new_name = full_name.strip() if full_name else user["full_name"]
    new_email = email.strip() if email else user["email"]
    if new_email.lower() != user["email"].lower():
        if db.scalar("SELECT COUNT(*) FROM users WHERE LOWER(email) = :e AND user_id <> :id",
                     {"e": new_email.lower(), "id": user["user_id"]}):
            raise conflict("That email address is already registered")
    try:
        db.execute(
            "UPDATE users SET full_name = :n, email = :e, updated_at = SYSTIMESTAMP "
            "WHERE user_id = :id", {"n": new_name, "e": new_email, "id": user["user_id"]})
    except Exception as exc:
        if is_unique_violation(exc) and violated_constraint(exc) == "UQ_USERS_EMAIL":
            raise conflict("That email address is already registered")
        raise
    db.commit()
    return user_view(load_user(db, user["user_id"]))


def set_role(db: Db, actor: dict, user_id: int, role: str) -> dict:
    if user_id == actor["user_id"]:
        raise bad_request("You cannot change your own role")
    if load_user(db, user_id) is None:
        raise not_found("User not found")
    db.execute(
        "UPDATE users SET role_id = (SELECT role_id FROM roles WHERE role_name = :r), "
        "updated_at = SYSTIMESTAMP WHERE user_id = :id", {"r": role, "id": user_id})
    db.commit()
    return user_view(load_user(db, user_id))


def set_active(db: Db, actor: dict, user_id: int, active: bool) -> dict:
    if not active and user_id == actor["user_id"]:
        raise bad_request("You cannot deactivate your own account")
    if load_user(db, user_id) is None:
        raise not_found("User not found")
    db.execute("UPDATE users SET is_active = :a, updated_at = SYSTIMESTAMP WHERE user_id = :id",
               {"a": "Y" if active else "N", "id": user_id})
    db.commit()
    return user_view(load_user(db, user_id))

