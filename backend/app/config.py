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


def _flag(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in ("1", "true", "yes", "on")


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
    session_max_age: int = 8 * 60 * 60              # server-side lifetime WITHOUT "Remember me"
    remember_days: int = 30                         # server-side lifetime WITH "Remember me"
    cookie_secure: bool = False                     # TMS_COOKIE_SECURE=true behind HTTPS
    # Password reset e-mail (SMTP). Unset host => reset requests send nothing.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_security: str = "starttls"                # starttls | ssl | none
    mail_from: str = ""
    app_base_url: str = ""                         # origin used in the e-mailed reset link
    reset_token_minutes: int = 15
    trust_proxy: bool = False                       # honour X-Forwarded-For for rate limits


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
            remember_days=int(os.getenv("TMS_REMEMBER_DAYS") or 30),
            cookie_secure=_flag("TMS_COOKIE_SECURE"),
            smtp_host=(os.getenv("TMS_SMTP_HOST") or "").strip(),
            smtp_port=int(os.getenv("TMS_SMTP_PORT") or 587),
            smtp_user=os.getenv("TMS_SMTP_USER") or "",
            smtp_password=os.getenv("TMS_SMTP_PASSWORD") or "",
            smtp_security=((os.getenv("TMS_SMTP_SECURITY") or "starttls").strip().lower()),
            mail_from=(os.getenv("TMS_MAIL_FROM") or "").strip(),
            app_base_url=(os.getenv("TMS_APP_BASE_URL") or "").strip(),
            reset_token_minutes=int(os.getenv("TMS_RESET_TOKEN_MINUTES") or 15),
            trust_proxy=_flag("TMS_TRUST_PROXY"),
        )
    return _settings
