"""Password reset: token issue, validation and single-use consumption.

Only the SHA-256 hash of a token is stored (PASSWORD_RESET_TOKENS.token_hash). A token is
valid for 15 minutes (`TMS_RESET_TOKEN_MINUTES`) and works exactly once: consumption is a
guarded UPDATE, so two concurrent requests cannot both succeed. Nothing here logs a token.
"""
import hashlib
import secrets

from app.db import Db
from app.security import hash_password

PER_ACCOUNT_PER_HOUR = 3        # database-backed backstop, shared across workers


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue_token(db: Db, email: str, minutes: int,
                request_ip: str | None) -> tuple[str, dict] | None:
    """Create a token for an ACTIVE account owning `email`.

    Returns (raw_token, {"email", "full_name"}) or None when there is nothing to send:
    unknown address, deactivated account (FR-007) or too many recent requests. The caller
    answers identically in every case.
    """
    user = db.one(
        "SELECT user_id, email, full_name, is_active FROM users WHERE LOWER(email) = :e",
        {"e": email.strip().lower()})
    if user is None or not user["is_active"]:
        return None
    recent = db.scalar(
        "SELECT COUNT(*) FROM password_reset_tokens "
        "WHERE user_id = :u AND created_at > SYSTIMESTAMP - NUMTODSINTERVAL(1, 'HOUR')",
        {"u": user["user_id"]})
    if recent >= PER_ACCOUNT_PER_HOUR:
        return None

    # A new request supersedes any link still outstanding for this account.
    db.execute("UPDATE password_reset_tokens SET used_at = SYSTIMESTAMP "
               "WHERE user_id = :u AND used_at IS NULL", {"u": user["user_id"]})
    raw = secrets.token_urlsafe(32)                      # 256 bits
    db.execute(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, request_ip) "
        "VALUES (:u, :h, SYSTIMESTAMP + NUMTODSINTERVAL(:m, 'MINUTE'), :ip)",
        {"u": user["user_id"], "h": hash_token(raw), "m": minutes,
         "ip": (request_ip or "")[:45] or None})
    # Housekeeping: tokens older than a day are useless; drop them.
    db.execute("DELETE FROM password_reset_tokens "
               "WHERE created_at < SYSTIMESTAMP - NUMTODSINTERVAL(1, 'DAY')")
    db.commit()
    return raw, {"email": user["email"], "full_name": user["full_name"]}


_VALID_TOKEN = """
    SELECT t.token_id, t.user_id
      FROM password_reset_tokens t JOIN users u ON u.user_id = t.user_id
     WHERE t.token_hash = :h AND t.used_at IS NULL AND t.expires_at > SYSTIMESTAMP
       AND u.is_active = 'Y'
"""


def is_token_valid(db: Db, raw: str) -> bool:
    return db.one(_VALID_TOKEN, {"h": hash_token(raw)}) is not None


def reset_password(db: Db, raw: str, new_password: str) -> bool:
    """Consume the token and set the new password. False if the token is not usable."""
    row = db.one(_VALID_TOKEN, {"h": hash_token(raw)})
    if row is None:
        return False
    # Guarded consume: only one caller can flip used_at from NULL.
    consumed = db.execute(
        "UPDATE password_reset_tokens SET used_at = SYSTIMESTAMP "
        "WHERE token_id = :id AND used_at IS NULL AND expires_at > SYSTIMESTAMP",
        {"id": row["token_id"]})
    if consumed != 1:
        db.rollback()
        return False
    db.execute("UPDATE users SET password_hash = :p, updated_at = SYSTIMESTAMP "
               "WHERE user_id = :u", {"p": hash_password(new_password), "u": row["user_id"]})
    db.execute("UPDATE password_reset_tokens SET used_at = SYSTIMESTAMP "
               "WHERE user_id = :u AND used_at IS NULL", {"u": row["user_id"]})
    db.commit()
    return True
