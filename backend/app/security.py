"""Password hashing. Plaintext is never stored or logged (FR-002)."""
import bcrypt

# Verified against a throwaway hash when the account does not exist, so response time does
# not reveal whether an email is registered.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=10))


MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72          # bcrypt ignores everything past 72 bytes


def validate_password_policy(value: str) -> str:
    """The one password policy (FR-002): 8+ characters and at most 72 UTF-8 bytes.
    Used by registration and by password reset; raises ValueError with a field message."""
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"must be at most {MAX_PASSWORD_BYTES} bytes")
    return value


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("ascii")


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        target = password_hash.encode("ascii") if password_hash else _DUMMY_HASH
        ok = bcrypt.checkpw(password.encode("utf-8"), target)
    except ValueError:
        return False
    return ok and password_hash is not None
