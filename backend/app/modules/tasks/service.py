"""Tasks: CRUD, assignment, status workflow, sharing and search
(FR-016..FR-035a, FR-046..FR-053; research.md R-004, R-005, R-009).

Every task read passes through `task_visibility_clause`; a task outside the caller's
visibility is a 404, never a 403 (FR-053).
"""
from dataclasses import dataclass
from datetime import date

from app.common.access import (TASK_SELECT, is_assignee, is_project_manager, is_project_member,
                               require_project_visible, require_task_visible,
                               task_visibility_clause)
from app.common.paging import PageParams, page_response
from app.db import Db
from app.deps import ADMIN
from app.errors import bad_request, forbidden, not_found
from app.modules.attachments import storage
from app.modules.notifications import service as notifications

STATUSES = ("TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED")      # Constitution VI, FR-027
PRIORITIES = ("LOW", "MEDIUM", "HIGH")
STATUS_LABELS = {"TO_DO": "To Do", "IN_PROGRESS": "In Progress", "REVIEW": "Review",
                 "COMPLETED": "Completed"}

# Whitelisted sort keys -> SQL (never interpolate user input into ORDER BY).
SORTS = {
    "title": "UPPER(t.title)",
    "dueDate": "t.due_date",
    "startDate": "t.start_date",
    "createdAt": "t.created_at",
    "priority": "pr.sort_order",
    "status": "s.sort_order",
}

OVERDUE_SQL = "(s.status_code <> 'COMPLETED' AND t.due_date IS NOT NULL AND t.due_date < TRUNC(SYSDATE))"


@dataclass
class TaskFilters:
    project_id: int | None = None
    user_id: int | None = None
    status: str | None = None
    priority: str | None = None
    due_date_from: date | None = None
    due_date_to: date | None = None
    title: str | None = None
    overdue: bool | None = None
    sort: str | None = None


# ---------------------------------------------------------------- views

def _assignees_for(db: Db, task_ids: list[int]) -> dict[int, list[dict]]:
    if not task_ids:
        return {}
    binds = {f"t{n}": tid for n, tid in enumerate(task_ids)}
    in_list = ", ".join(f":{k}" for k in binds)
    rows = db.query(
        f"""SELECT ta.task_id, u.user_id, u.full_name
              FROM task_assignees ta JOIN users u ON u.user_id = ta.user_id
             WHERE ta.task_id IN ({in_list}) ORDER BY u.full_name, u.user_id""", binds)
    out: dict[int, list[dict]] = {}
    for r in rows:
        out.setdefault(r["task_id"], []).append({"userId": r["user_id"], "fullName": r["full_name"]})
    return out


def task_views(db: Db, rows: list[dict]) -> list[dict]:
    assignees = _assignees_for(db, [r["task_id"] for r in rows])
    today = date.today()
    return [{
        "taskId": r["task_id"],
        "projectId": r["project_id"],
        "projectName": r["project_name"],
        "title": r["title"],
        "description": r["description"],
        "status": r["status"],
        "priority": r["priority"],
        "startDate": r["start_date"],
        "dueDate": r["due_date"],
        "overdue": bool(r["status"] != "COMPLETED" and r["due_date"] and r["due_date"] < today),
        "createdBy": r["created_by"],
        "createdAt": r["created_at"],
        "updatedAt": r["updated_at"],
        "assignees": assignees.get(r["task_id"], []),
    } for r in rows]


def get_task(db: Db, user: dict, task_id: int) -> dict:
    row = require_task_visible(db, user, task_id)
    return task_views(db, [row])[0]


# ---------------------------------------------------------------- search / lists

def _like(value: str) -> str:
    escaped = value.strip().upper().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def search_tasks(db: Db, user: dict, filters: TaskFilters, params: PageParams,
                 scope: str | None = None) -> dict:
    """The single search-and-filter path (R-009). Filters are combined with AND and always
    intersected with the visibility predicate, so no combination can reveal a hidden task."""
    clause, binds = task_visibility_clause(user, "t")
    where = [clause]
    binds = dict(binds)

    if scope == "assigned":
        where.append("EXISTS (SELECT 1 FROM task_assignees sa WHERE sa.task_id = t.task_id "
                     "AND sa.user_id = :me)")
        binds["me"] = user["user_id"]
    elif scope == "shared":      # FR-035: project member who is NOT an assignee
        where.append("EXISTS (SELECT 1 FROM project_members sm WHERE sm.project_id = t.project_id "
                     "AND sm.user_id = :me)")
        where.append("NOT EXISTS (SELECT 1 FROM task_assignees sa WHERE sa.task_id = t.task_id "
                     "AND sa.user_id = :me)")
        binds["me"] = user["user_id"]

    if filters.project_id is not None:
        where.append("t.project_id = :f_project")
        binds["f_project"] = filters.project_id
    if filters.user_id is not None:
        where.append("EXISTS (SELECT 1 FROM task_assignees fa WHERE fa.task_id = t.task_id "
                     "AND fa.user_id = :f_user)")
        binds["f_user"] = filters.user_id
    if filters.status:
        where.append("s.status_code = :f_status")
        binds["f_status"] = filters.status
    if filters.priority:
        where.append("pr.priority_code = :f_priority")
        binds["f_priority"] = filters.priority
    if filters.due_date_from:
        where.append("t.due_date >= :f_due_from")
        binds["f_due_from"] = filters.due_date_from
    if filters.due_date_to:
        where.append("t.due_date <= :f_due_to")
        binds["f_due_to"] = filters.due_date_to
    if filters.title and filters.title.strip():
        where.append("UPPER(t.title) LIKE :f_title ESCAPE '\\'")
        binds["f_title"] = _like(filters.title)
    if filters.overdue is True:
        where.append(OVERDUE_SQL)
    elif filters.overdue is False:
        where.append(f"NOT {OVERDUE_SQL}")

    order = "t.due_date NULLS LAST, t.task_id"
    if filters.sort:
        key, _, direction = filters.sort.partition(",")
        if key not in SORTS:
            raise bad_request("Unknown sort field", sort=f"must be one of {', '.join(SORTS)}")
        order = f"{SORTS[key]} {'DESC' if direction.lower() == 'desc' else 'ASC'}, t.task_id"

    where_sql = " AND ".join(where)
    frm = """FROM tasks t
             JOIN projects p       ON p.project_id   = t.project_id
             JOIN task_status s    ON s.status_id    = t.status_id
             JOIN task_priority pr ON pr.priority_id = t.priority_id"""
    total = db.scalar(f"SELECT COUNT(*) {frm} WHERE {where_sql}", binds)
    rows = db.query(
        f"{TASK_SELECT} WHERE {where_sql} ORDER BY {order} "
        f"OFFSET :off ROWS FETCH NEXT :sz ROWS ONLY",
        {**binds, "off": params.offset, "sz": params.size})
    return page_response(task_views(db, rows), params, total)


# ---------------------------------------------------------------- assignment helpers

def _validate_assignees(db: Db, project_id: int, user_ids: list[int]) -> list[int]:
    ids = list(dict.fromkeys(user_ids))
    for uid in ids:
        row = db.one("SELECT is_active FROM users WHERE user_id = :u", {"u": uid})
        if row is None:
            raise bad_request("Assignee does not exist", assigneeIds=f"user {uid} does not exist")
        if not row["is_active"]:
            raise bad_request("Assignee is deactivated",
                              assigneeIds=f"user {uid} is deactivated")
        if not is_project_member(db, {"role": "MEMBER", "user_id": uid}, project_id):
            raise bad_request("Assignees must be members of the task's project",
                              assigneeIds=f"user {uid} is not a member of the project")
    return ids


def _insert_assignees(db: Db, task: dict, user_ids: list[int], actor: dict) -> list[int]:
    added = []
    for uid in user_ids:
        if is_assignee(db, task["task_id"], uid):
            continue
        db.execute("INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (:t, :u, :a)",
                   {"t": task["task_id"], "u": uid, "a": actor["user_id"]})
        added.append(uid)
    if added:
        notifications.notify(
            db, task=task, recipient_ids=added, trigger_type=notifications.ASSIGNMENT,
            message=f'You were assigned to "{task["title"]}"', actor_id=actor["user_id"])
    return added


def _validate_dates(start: date | None, due: date | None) -> None:
    if start and due and due < start:       # US3 scenario 5
        raise bad_request("Due date must not be earlier than start date",
                          dueDate="must not be earlier than start date")


# ---------------------------------------------------------------- create / update / delete

def create_task(db: Db, user: dict, *, project_id: int, title: str, description: str | None,
                priority: str, start_date: date | None, due_date: date | None,
                assignee_ids: list[int]) -> dict:
    require_project_visible(db, user, project_id)          # 404 if not a member
    _validate_dates(start_date, due_date)
    if assignee_ids and not is_project_manager(db, user, project_id):
        raise forbidden("Only a Manager of the project may assign tasks to others")  # FR-032
    assignee_ids = _validate_assignees(db, project_id, assignee_ids)

    status_id = db.scalar("SELECT status_id FROM task_status WHERE status_code = 'TO_DO'")
    priority_id = db.scalar("SELECT priority_id FROM task_priority WHERE priority_code = :p",
                            {"p": priority})
    task_id = db.insert(
        """INSERT INTO tasks (project_id, title, description, status_id, priority_id,
                              start_date, due_date, created_by)
           VALUES (:project_id, :title, :description, :status_id, :priority_id,
                   :start_date, :due_date, :created_by)""",
        {"project_id": project_id, "title": title.strip(), "description": description,
         "status_id": status_id, "priority_id": priority_id, "start_date": start_date,
         "due_date": due_date, "created_by": user["user_id"]}, "task_id")
    task = require_task_visible(db, user, task_id)
    _insert_assignees(db, task, assignee_ids, user)
    db.commit()
    return get_task(db, user, task_id)


def update_task(db: Db, user: dict, task_id: int, fields: dict) -> dict:
    """`fields` holds only the keys the client sent (title, description, priority,
    start_date, due_date). Status is never changed here (R-005)."""
    task = require_task_visible(db, user, task_id)
    start = fields.get("start_date", task["start_date"])
    due = fields.get("due_date", task["due_date"])
    _validate_dates(start, due)

    sets, binds = [], {"id": task_id}
    if "title" in fields:
        sets.append("title = :title")
        binds["title"] = fields["title"].strip()
    if "description" in fields:
        sets.append("description = :description")
        binds["description"] = fields["description"]
    if "priority" in fields:
        sets.append("priority_id = (SELECT priority_id FROM task_priority "
                    "WHERE priority_code = :priority)")
        binds["priority"] = fields["priority"]
    if "start_date" in fields:
        sets.append("start_date = :start_date")
        binds["start_date"] = fields["start_date"]
    if "due_date" in fields:
        sets.append("due_date = :due_date")
        binds["due_date"] = fields["due_date"]
    if sets:
        db.execute(f"UPDATE tasks SET {', '.join(sets)}, updated_at = SYSTIMESTAMP "
                   f"WHERE task_id = :id", binds)
        _notify_involved(db, task, user, f'Task "{task["title"]}" was updated')
    db.commit()
    return get_task(db, user, task_id)


def _notify_involved(db: Db, task: dict, actor: dict, message: str) -> None:
    involved = [r["user_id"] for r in db.query(
        "SELECT user_id FROM task_assignees WHERE task_id = :t", {"t": task["task_id"]})]
    involved.append(task["created_by"])
    notifications.notify(db, task=task, recipient_ids=involved,
                         trigger_type=notifications.UPDATE, message=message,
                         actor_id=actor["user_id"])


def delete_task(db: Db, user: dict, task_id: int) -> None:
    task = require_task_visible(db, user, task_id)
    if not (is_project_manager(db, user, task["project_id"])
            or task["created_by"] == user["user_id"]):
        raise forbidden()
    files = [r["stored_name"] for r in db.query(
        "SELECT stored_name FROM attachments WHERE task_id = :t", {"t": task_id})]
    db.execute("DELETE FROM tasks WHERE task_id = :t", {"t": task_id})   # cascades (SC-011)
    db.commit()
    storage.remove_quietly(files)


# ---------------------------------------------------------------- status (R-005)

def change_status(db: Db, user: dict, task_id: int, new_status: str) -> None:
    """The ONLY route that changes status. Free movement among the four statuses; anything
    else is rejected (FR-027, R-005, R-015)."""
    if new_status not in STATUSES:
        raise bad_request("Invalid status", status=f"must be one of {', '.join(STATUSES)}")
    task = require_task_visible(db, user, task_id)
    if not (user["role"] == ADMIN or is_assignee(db, task_id, user["user_id"])
            or is_project_manager(db, user, task["project_id"])):
        raise forbidden("Only an assignee, a Manager of the project, or an Admin may change status")
    db.execute(
        "UPDATE tasks SET status_id = (SELECT status_id FROM task_status WHERE status_code = :s), "
        "updated_at = SYSTIMESTAMP WHERE task_id = :t", {"s": new_status, "t": task_id})
    _notify_involved(db, task, user,
                     f'Status of "{task["title"]}" changed to {STATUS_LABELS[new_status]}')
    db.commit()


# ---------------------------------------------------------------- assignees

def assign(db: Db, user: dict, task_id: int, user_ids: list[int]) -> dict:
    task = require_task_visible(db, user, task_id)
    if not is_project_manager(db, user, task["project_id"]):
        raise forbidden()
    ids = _validate_assignees(db, task["project_id"], user_ids)
    _insert_assignees(db, task, ids, user)
    db.commit()
    return get_task(db, user, task_id)


def unassign(db: Db, user: dict, task_id: int, user_id: int) -> None:
    task = require_task_visible(db, user, task_id)
    if not is_project_manager(db, user, task["project_id"]):
        raise forbidden()
    if not is_assignee(db, task_id, user_id):
        raise not_found("User is not assigned to this task")
    db.execute("DELETE FROM task_assignees WHERE task_id = :t AND user_id = :u",
               {"t": task_id, "u": user_id})
    db.commit()
