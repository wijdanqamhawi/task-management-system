"""Dashboard figures via the PKG_DASHBOARD PL/SQL package (research.md R-006, FR-036..FR-045).

Every routine takes the acting user id and applies visibility inside the database, so a caller
cannot forget to scope a figure. Figures are computed per request and never cached.
"""
from app.db import Db

STATUSES = ("TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED")
PRIORITIES = ("LOW", "MEDIUM", "HIGH")


def totals(db: Db, user_id: int) -> dict:
    values = db.call_proc("pkg_dashboard.get_totals", [user_id], 5)
    keys = ("totalProjects", "totalTasks", "completedTasks", "pendingTasks", "overdueTasks")
    return {k: int(v or 0) for k, v in zip(keys, values)}


def tasks_by_status(db: Db, user_id: int) -> dict:
    counts = {s: 0 for s in STATUSES}
    for r in db.call_cursor("pkg_dashboard.tasks_by_status", user_id):
        counts[r["status_code"]] = int(r["task_count"])
    return counts


def tasks_by_priority(db: Db, user_id: int) -> dict:
    counts = {p: 0 for p in PRIORITIES}
    for r in db.call_cursor("pkg_dashboard.tasks_by_priority", user_id):
        counts[r["priority_code"]] = int(r["task_count"])
    return counts


def tasks_by_user(db: Db, user_id: int) -> list[dict]:
    return [{"userId": int(r["user_id"]), "fullName": r["full_name"],
             "taskCount": int(r["task_count"])}
            for r in db.call_cursor("pkg_dashboard.tasks_by_user", user_id)]


def _progress(r: dict) -> dict:
    return {"projectId": int(r["project_id"]), "name": r["name"],
            "totalTasks": int(r["total_tasks"]), "completedTasks": int(r["completed_tasks"]),
            "percentComplete": int(round(r["percent_complete"] or 0))}


def project_progress(db: Db, user_id: int) -> list[dict]:
    return [_progress(r) for r in db.call_cursor("pkg_dashboard.project_progress", user_id)]


def project_progress_one(db: Db, user_id: int, project_id: int) -> dict | None:
    rows = db.call_cursor("pkg_dashboard.project_progress_one", user_id, project_id)
    return _progress(rows[0]) if rows else None

