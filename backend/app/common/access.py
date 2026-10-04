"""The single shared visibility rule (research.md R-004) and the data-dependent permission
checks (R-003, layer 2).

A user may see a project, and every task in it, if they are a member of the project or hold
ADMIN. Every task read goes through `task_visibility_clause`, so a list, a search, a count and
a detail view cannot drift apart (FR-045, FR-053).
"""
from app.db import Db
from app.deps import ADMIN, MANAGER
from app.errors import forbidden, not_found


def task_visibility_clause(user: dict, task_alias: str = "t") -> tuple[str, dict]:
    """SQL fragment (and binds) restricting `task_alias` rows to tasks the user may see."""
    if user["role"] == ADMIN:
        return "1 = 1", {}
    return (
        f"EXISTS (SELECT 1 FROM project_members vpm "
        f"WHERE vpm.project_id = {task_alias}.project_id AND vpm.user_id = :vis_user_id)",
        {"vis_user_id": user["user_id"]},
    )


def project_visibility_clause(user: dict, project_alias: str = "p") -> tuple[str, dict]:
    if user["role"] == ADMIN:
        return "1 = 1", {}
    return (
        f"EXISTS (SELECT 1 FROM project_members vpm "
        f"WHERE vpm.project_id = {project_alias}.project_id AND vpm.user_id = :vis_user_id)",
        {"vis_user_id": user["user_id"]},
    )


def is_project_member(db: Db, user: dict, project_id: int) -> bool:
    if user["role"] == ADMIN:
        return True
    return db.scalar(
        "SELECT COUNT(*) FROM project_members WHERE project_id = :p AND user_id = :u",
        {"p": project_id, "u": user["user_id"]}) > 0


def is_project_manager(db: Db, user: dict, project_id: int) -> bool:
    """Admin, or a MANAGER who belongs to the project (a role alone is not enough)."""
    if user["role"] == ADMIN:
        return True
    return user["role"] == MANAGER and is_project_member(db, user, project_id)


def require_project_visible(db: Db, user: dict, project_id: int) -> dict:
    """Return the project row, or 404 if it does not exist or is not visible to the user."""
    clause, binds = project_visibility_clause(user, "p")
    row = db.one(
        f"SELECT p.project_id, p.name, p.description, p.status, p.start_date, p.end_date, "
        f"p.created_by, p.created_at, p.updated_at FROM projects p "
        f"WHERE p.project_id = :project_id AND {clause}",
        {"project_id": project_id, **binds})
    if row is None:
        raise not_found("Project not found")
    return row


def require_project_manager(db: Db, user: dict, project_id: int) -> dict:
    project = require_project_visible(db, user, project_id)
    if not is_project_manager(db, user, project_id):
        raise forbidden()
    return project


TASK_SELECT = """
    SELECT t.task_id, t.project_id, p.name AS project_name, t.title, t.description,
           s.status_code AS status, pr.priority_code AS priority,
           t.start_date, t.due_date, t.created_by, t.created_at, t.updated_at
      FROM tasks t
      JOIN projects p       ON p.project_id   = t.project_id
      JOIN task_status s    ON s.status_id    = t.status_id
      JOIN task_priority pr ON pr.priority_id = t.priority_id
"""


def require_task_visible(db: Db, user: dict, task_id: int) -> dict:
    """Return the task row, or 404 (not 403) if it is not visible: invisible tasks must not
    be disclosed (FR-053, contract status codes)."""
    clause, binds = task_visibility_clause(user, "t")
    row = db.one(f"{TASK_SELECT} WHERE t.task_id = :task_id AND {clause}",
                 {"task_id": task_id, **binds})
    if row is None:
        raise not_found("Task not found")
    return row


def is_assignee(db: Db, task_id: int, user_id: int) -> bool:
    return db.scalar(
        "SELECT COUNT(*) FROM task_assignees WHERE task_id = :t AND user_id = :u",
        {"t": task_id, "u": user_id}) > 0
