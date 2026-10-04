"""Environment-driven settings. Nothing secret is hardcoded (Constitution II)."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")   # repo-root .env, if present


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Environment variable {name} is required (see .env.example)")
    return value


@dataclass(frozen=True)
class Settings:
    db_user: str
    db_password: str
    db_dsn: str
    session_secret: str
    attachment_dir: Path
    max_upload_bytes: int = 10 * 1024 * 1024        # R-008: per-file size limit
    allowed_upload_types: frozenset = frozenset({
        "application/pdf", "image/png", "image/jpeg", "image/gif", "text/plain", "text/csv",
        "application/zip",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    session_max_age: int = 8 * 60 * 60


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        attachment_dir = Path(os.getenv("TMS_ATTACHMENT_DIR") or "./attachments")
        if not attachment_dir.is_absolute():
            attachment_dir = _BACKEND_DIR / attachment_dir
        _settings = Settings(
            db_user=_required("TMS_DB_USER"),
            db_password=_required("TMS_DB_PASSWORD"),
            db_dsn=_required("TMS_DB_DSN"),
            session_secret=_required("TMS_SESSION_SECRET"),
            attachment_dir=attachment_dir,
        )
    return _settings
