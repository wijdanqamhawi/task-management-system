"""Recycle Bin: list soft-deleted tasks and restore them (RECYCLE_BIN_VIEW, TASK_RESTORE).

Soft deletion itself is `tasks.service.delete_task`. There is deliberately NO permanent deletion
anywhere in the application.

Scope follows manager scope of the project: ADMIN (PROJECT_MANAGE_ALL) sees and restores tasks of
every project, a MANAGER only those of projects they are a member of, a MEMBER nothing (403, the
permissions are not granted to the role). A task outside the caller's scope is a 404.
"""
from app.common import audit
from app.common.access import (is_project_manager, lock_project, recycle_bin_clause,
                               require_task_visible)
from app.common.paging import PageParams, page_response
from app.common.permissions import RECYCLE_BIN_VIEW, TASK_RESTORE, has_permission
from app.db import Db
from app.errors import bad_request, conflict, forbidden, not_found
from app.modules.notifications import service as notifications
from app.modules.tasks import service as tasks

_SELECT = """
    SELECT t.task_id, t.project_id, p.name AS project_name, t.title, t.created_by,
           t.deleted_at, t.deleted_by, du.full_name AS deleted_by_name
      FROM tasks t
      JOIN projects p       ON p.project_id = t.project_id
      LEFT JOIN users du    ON du.user_id   = t.deleted_by
"""

SORTS = {
    "deletedAt": "t.deleted_at",
    "title": "UPPER(t.title)",
    "project": "UPPER(p.name)",
}


def _view(r: dict) -> dict:
    return {"taskId": r["task_id"], "projectId": r["project_id"], "projectName": r["project_name"],
            "title": r["title"], "deletedAt": r["deleted_at"], "deletedBy": r["deleted_by"],
            "deletedByName": r["deleted_by_name"]}


def list_deleted(db: Db, user: dict, params: PageParams, *, search: str | None = None,
                 project_id: int | None = None, sort: str | None = None) -> dict:
    if not has_permission(user, RECYCLE_BIN_VIEW):
        raise forbidden()
    clause, binds = recycle_bin_clause(user, "t")
    where, binds = [clause], dict(binds)
    if project_id is not None:
        where.append("t.project_id = :f_project")
        binds["f_project"] = project_id
    if search and search.strip():
        where.append("(UPPER(t.title) LIKE :f_q ESCAPE '\\' OR UPPER(p.name) LIKE :f_q ESCAPE '\\')")
        binds["f_q"] = tasks._like(search)
    order = "t.deleted_at DESC, t.task_id DESC"
    if sort:
        key, _, direction = sort.partition(",")
        if key not in SORTS:
            raise bad_request("Unknown sort field", sort=f"must be one of {', '.join(SORTS)}")
        order = f"{SORTS[key]} {'DESC' if direction.lower() == 'desc' else 'ASC'}, t.task_id"
    where_sql = " AND ".join(where)
    total = db.scalar(
        f"SELECT COUNT(*) FROM tasks t JOIN projects p ON p.project_id = t.project_id "
        f"WHERE {where_sql}", binds)
    rows = db.query(
        f"{_SELECT} WHERE {where_sql} ORDER BY {order} OFFSET :off ROWS FETCH NEXT :sz ROWS ONLY",
        {**binds, "off": params.offset, "sz": params.size})
    return page_response([_view(r) for r in rows], params, total)


def _bin_row(db: Db, user: dict, task_id: int) -> dict | None:
    clause, binds = recycle_bin_clause(user, "t")
    return db.one(f"{_SELECT} WHERE t.task_id = :task_id AND {clause}",
                  {"task_id": task_id, **binds})


def _assignee_problems(db: Db, task_id: int, project_id: int) -> list[dict]:
    """Assignees of the deleted task who may no longer hold it: deactivated, or no longer a
    member of the project. Their user rows are locked so a concurrent deactivation waits."""
    db.query("SELECT user_id FROM users WHERE user_id IN "
             "(SELECT user_id FROM task_assignees WHERE task_id = :t) FOR UPDATE", {"t": task_id})
    rows = db.query(
        """SELECT u.user_id, u.full_name, u.is_active,
                  (SELECT COUNT(*) FROM project_members pm
                    WHERE pm.project_id = :p AND pm.user_id = u.user_id) AS member
             FROM task_assignees ta JOIN users u ON u.user_id = ta.user_id
            WHERE ta.task_id = :t ORDER BY u.full_name, u.user_id""",
        {"t": task_id, "p": project_id})
    problems = []
    for r in rows:
        if not r["is_active"]:
            problems.append({"userId": r["user_id"], "fullName": r["full_name"],
                             "reason": "account is deactivated"})
        elif not r["member"]:
            problems.append({"userId": r["user_id"], "fullName": r["full_name"],
                             "reason": "no longer a member of the project"})
    return problems


def restore_task(db: Db, user: dict, task_id: int) -> dict:
    """Bring a soft-deleted task back exactly as it was, validating who is still eligible.

    Restored unchanged: the task, its Progress items, comments, attachments, notifications and
    the assignments of every assignee who is still an ACTIVE MEMBER of the project. Assignees who
    are deactivated or were removed from the project meanwhile are unassigned, and reported in
    `removedAssignees` so the caller can tell the user. Everything happens in one transaction."""
    if not has_permission(user, TASK_RESTORE):
        raise forbidden()
    row = _bin_row(db, user, task_id)
    if row is None:
        raise not_found("Task not found in the Recycle Bin")
    project_id = row["project_id"]

    lock_project(db, project_id)       # serialises with assign, member removal, delete, restore
    # Re-check authority under the lock: a membership change committed while we waited counts.
    if not is_project_manager(db, user, project_id, TASK_RESTORE):
        raise not_found("Task not found in the Recycle Bin")
    locked = db.one("SELECT title, is_deleted FROM tasks WHERE task_id = :t FOR UPDATE",
                    {"t": task_id})
    if locked is None or not locked["is_deleted"]:
        raise conflict("This task was already restored")

    removed = _assignee_problems(db, task_id, project_id)
    for r in removed:
        db.execute("DELETE FROM task_assignees WHERE task_id = :t AND user_id = :u",
                   {"t": task_id, "u": r["userId"]})
    changed = db.execute(
        "UPDATE tasks SET is_deleted = 'N', deleted_at = NULL, deleted_by = NULL, "
        "updated_at = SYSTIMESTAMP WHERE task_id = :t AND is_deleted = 'Y'", {"t": task_id})
    if changed == 0:
        raise conflict("This task was already restored")

    details = None
    if removed:
        details = "Unassigned on restore: " + "; ".join(
            f"{r['fullName']} (user {r['userId']}, {r['reason']})" for r in removed)
    audit.record(db, action=audit.RESTORE, task={**row, "title": locked["title"]},
                 actor_id=user["user_id"], details=details)

    restored = require_task_visible(db, user, task_id)
    involved = [r["user_id"] for r in db.query(
        "SELECT user_id FROM task_assignees WHERE task_id = :t", {"t": task_id})]
    involved.append(restored["created_by"])
    notifications.notify(db, task=restored, recipient_ids=involved,
                         trigger_type=notifications.UPDATE,
                         message=f'Task "{restored["title"]}" was restored from the Recycle Bin',
                         actor_id=user["user_id"])
    db.commit()
    return {"task": tasks.task_views(db, [restored])[0], "removedAssignees": removed}
