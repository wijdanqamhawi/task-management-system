"""Append-only audit log for soft delete and restore (table TASK_AUDIT_LOG, migration 004).

Written in the SAME transaction as the change it records, so a rolled-back delete or restore
leaves no entry and a committed one always has one. Nothing ever updates or deletes a row here.
"""
from app.db import Db

DELETE, RESTORE = "DELETE", "RESTORE"


def record(db: Db, *, action: str, task: dict, actor_id: int, details: str | None = None) -> None:
    db.execute(
        "INSERT INTO task_audit_log (task_id, project_id, task_title, action, actor_id, details) "
        "VALUES (:t, :p, :title, :a, :u, :d)",
        {"t": task["task_id"], "p": task["project_id"], "title": task["title"][:200],
         "a": action, "u": actor_id, "d": details[:1000] if details else None})
