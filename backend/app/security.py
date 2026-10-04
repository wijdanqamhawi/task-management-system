"""Password hashing. Plaintext is never stored or logged (FR-002)."""
import bcrypt

# Verified against a throwaway hash when the account does not exist, so response time does
# not reveal whether an email is registered.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=10))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("ascii")


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        target = password_hash.encode("ascii") if password_hash else _DUMMY_HASH
        ok = bcrypt.checkpw(password.encode("utf-8"), target)
    except ValueError:
        return False
    return ok and password_hash is not None
