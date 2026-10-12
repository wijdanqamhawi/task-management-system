"""Filesystem storage for attachment bytes (research.md R-008).

Stored filenames are generated here and never derived from user input, so a hostile upload
name cannot traverse paths or collide with another file.
"""
import logging
import uuid
from pathlib import Path

from app.config import get_settings

log = logging.getLogger("tms.attachments")


def new_stored_name() -> str:
    return uuid.uuid4().hex


def _path(stored_name: str) -> Path:
    base = get_settings().attachment_dir.resolve()
    path = (base / stored_name).resolve()
    if path.parent != base:                 # defence in depth; names are system-generated
        raise ValueError("Invalid stored name")
    return path


def write(stored_name: str, data: bytes) -> None:
    base = get_settings().attachment_dir
    base.mkdir(parents=True, exist_ok=True)
    _path(stored_name).write_bytes(data)


def exists(stored_name: str) -> bool:
    return _path(stored_name).is_file()


def path_of(stored_name: str) -> Path:
    return _path(stored_name)


def remove_quietly(stored_names) -> None:
    """Best-effort removal after the database rows are gone. Never raises."""
    for name in stored_names:
        try:
            _path(name).unlink(missing_ok=True)
        except Exception as exc:
            log.warning("Could not remove attachment file %s: %s", name, exc)
