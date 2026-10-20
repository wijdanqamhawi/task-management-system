"""Attachments (FR-025, research.md R-008).

Bytes live on the filesystem; the database holds metadata only. A row is written ONLY after the
file has been stored successfully. Downloads stream through the backend after the same
visibility check as the task, never via a direct storage URL.
"""
import re
import unicodedata

from fastapi import APIRouter, Depends, File, Response, UploadFile
from fastapi.responses import FileResponse

from app.common.access import is_project_manager, require_task_visible
from app.common.permissions import ATTACHMENT_DELETE_ANY, ATTACHMENT_DELETE_OWN, has_permission
from app.config import get_settings
from app.db import Db, get_db
from app.deps import current_user
from app.errors import ApiError, bad_request, forbidden, not_found
from app.modules.attachments import storage

router = APIRouter(tags=["attachments"])

_SELECT = """SELECT a.attachment_id, a.task_id, a.uploaded_by, u.full_name AS uploader_name,
                    a.original_name, a.stored_name, a.content_type, a.size_bytes, a.uploaded_at
               FROM attachments a JOIN users u ON u.user_id = a.uploaded_by"""


def _view(r: dict) -> dict:
    return {"attachmentId": r["attachment_id"], "taskId": r["task_id"],
            "originalName": r["original_name"], "contentType": r["content_type"],
            "sizeBytes": r["size_bytes"], "uploadedBy": r["uploaded_by"],
            "uploaderName": r["uploader_name"], "uploadedAt": r["uploaded_at"]}


def _clean_name(name: str | None) -> str:
    name = (name or "file").replace("\\", "/").split("/")[-1]
    name = "".join(ch for ch in unicodedata.normalize("NFC", name) if ch.isprintable())
    name = re.sub(r'[<>:"|?*]', "_", name).strip(" .") or "file"
    return name[:255]


@router.get("/api/tasks/{task_id}/attachments")
def list_attachments(task_id: int, user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_task_visible(db, user, task_id)
    rows = db.query(f"{_SELECT} WHERE a.task_id = :t ORDER BY a.uploaded_at, a.attachment_id",
                    {"t": task_id})
    return [_view(r) for r in rows]


@router.post("/api/tasks/{task_id}/attachments", status_code=201)
def upload_attachment(task_id: int, response: Response, file: UploadFile = File(...),
                      user: dict = Depends(current_user), db: Db = Depends(get_db)):
    require_task_visible(db, user, task_id)
    settings = get_settings()
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in settings.allowed_upload_types:
        raise ApiError(415, "File type is not allowed")
    data = file.file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise ApiError(413, f"File exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB limit")
    if not data:
        raise bad_request("File is empty", file="must not be empty")

    stored_name = storage.new_stored_name()          # system-generated, never user input
    storage.write(stored_name, data)                 # 1. store the bytes
    try:                                             # 2. only then write the row
        attachment_id = db.insert(
            """INSERT INTO attachments (task_id, uploaded_by, original_name, stored_name,
                                        content_type, size_bytes)
               VALUES (:t, :u, :orig, :stored, :ct, :nbytes)""",
            {"t": task_id, "u": user["user_id"], "orig": _clean_name(file.filename),
             "stored": stored_name, "ct": content_type, "nbytes": len(data)}, "attachment_id")
        db.commit()
    except Exception:
        db.rollback()
        storage.remove_quietly([stored_name])        # no orphan file when the row failed
        raise
    response.headers["Location"] = f"/api/attachments/{attachment_id}"
    return _view(db.one(f"{_SELECT} WHERE a.attachment_id = :id", {"id": attachment_id}))


def _load(db: Db, user: dict, attachment_id: int) -> dict:
    row = db.one(f"{_SELECT} WHERE a.attachment_id = :id", {"id": attachment_id})
    if row is None:
        raise not_found("Attachment not found")
    require_task_visible(db, user, row["task_id"])   # 404 outside the caller's projects
    return row


@router.get("/api/attachments/{attachment_id}")
def download_attachment(attachment_id: int, user: dict = Depends(current_user),
                        db: Db = Depends(get_db)):
    row = _load(db, user, attachment_id)
    if not storage.exists(row["stored_name"]):
        raise not_found("Attachment file is missing")
    return FileResponse(storage.path_of(row["stored_name"]), media_type=row["content_type"],
                        filename=row["original_name"])


@router.delete("/api/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, user: dict = Depends(current_user),
                      db: Db = Depends(get_db)):
    row = _load(db, user, attachment_id)
    task = require_task_visible(db, user, row["task_id"])
    uploader = (row["uploaded_by"] == user["user_id"]
                and has_permission(user, ATTACHMENT_DELETE_OWN))
    if not (uploader or is_project_manager(db, user, task["project_id"], ATTACHMENT_DELETE_ANY)):
        raise forbidden()
    db.execute("DELETE FROM attachments WHERE attachment_id = :id", {"id": attachment_id})
    db.commit()
    storage.remove_quietly([row["stored_name"]])
    return Response(status_code=204)
