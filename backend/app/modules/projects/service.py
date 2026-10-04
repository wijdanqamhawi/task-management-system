"""Projects and membership (FR-009..FR-015, FR-008b, FR-044)."""
from datetime import date

from app.common.access import (project_visibility_clause, require_project_manager,
                               require_project_visible)
from app.common.paging import PageParams, page_response
from app.db import Db, is_unique_violation
from app.errors import bad_request, conflict, not_found
from app.modules.attachments import storage
from app.modules.dashboard import repository as dashboard_repo


def validate_dates(start: date | None, end: date | None) -> None:
    if start and end and end < start:      # US2 scenario 5
        raise bad_request("End date must not be earlier than start date",
                          endDate="must not be earlier than start date")


def project_view(row: dict, **extra) -> dict:
    return {
        "projectId": row["project_id"],
        "name": row["name"],
        "description": row["description"],
        "status": row["status"],
        "startDate": row["start_date"],
        "endDate": row["end_date"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        **extra,
    }


def _member_view(row: dict) -> dict:
    return {"userId": row["user_id"], "username": row["username"], "fullName": row["full_name"],
            "email": row["email"], "role": row["role"], "isActive": row["is_active"],
            "addedAt": row["added_at"]}


def list_members(db: Db, project_id: int) -> list[dict]:
    rows = db.query(
        """SELECT u.user_id, u.username, u.full_name, u.email, u.is_active, r.role_name AS role,
                  pm.added_at
             FROM project_members pm
             JOIN users u ON u.user_id = pm.user_id
             JOIN roles r ON r.role_id = u.role_id
            WHERE pm.project_id = :p ORDER BY u.full_name, u.user_id""", {"p": project_id})
    return [_member_view(r) for r in rows]


def list_projects(db: Db, user: dict, params: PageParams) -> dict:
    clause, binds = project_visibility_clause(user, "p")
    total = db.scalar(f"SELECT COUNT(*) FROM projects p WHERE {clause}", binds)
    rows = db.query(
        f"""SELECT p.project_id, p.name, p.description, p.status, p.start_date, p.end_date,
                   p.created_by, p.created_at, p.updated_at,
                   (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.project_id)
                       AS member_count
              FROM projects p WHERE {clause}
             ORDER BY p.name, p.project_id
            OFFSET :off ROWS FETCH NEXT :sz ROWS ONLY""",
        {**binds, "off": params.offset, "sz": params.size})
    return page_response([project_view(r, memberCount=r["member_count"]) for r in rows],
                         params, total)


def get_project(db: Db, user: dict, project_id: int) -> dict:
    project = require_project_visible(db, user, project_id)
    return project_view(project, members=list_members(db, project_id))


def create_project(db: Db, user: dict, *, name: str, description: str | None, status: str,
                   start_date: date | None, end_date: date | None) -> dict:
    validate_dates(start_date, end_date)
    project_id = db.insert(
        """INSERT INTO projects (name, description, status, start_date, end_date, created_by)
           VALUES (:name, :description, :status, :start_date, :end_date, :created_by)""",
        {"name": name.strip(), "description": description, "status": status,
         "start_date": start_date, "end_date": end_date, "created_by": user["user_id"]},
        "project_id")
    # The creator becomes a member so a Manager is "a Manager of" their own project.
    db.execute("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)",
               {"p": project_id, "u": user["user_id"]})
    db.commit()
    return get_project(db, user, project_id)


def update_project(db: Db, user: dict, project_id: int, *, name: str, description: str | None,
                   status: str, start_date: date | None, end_date: date | None) -> dict:
    require_project_manager(db, user, project_id)
    validate_dates(start_date, end_date)
    db.execute(
        """UPDATE projects SET name = :name, description = :description, status = :status,
                  start_date = :start_date, end_date = :end_date, updated_at = SYSTIMESTAMP
            WHERE project_id = :id""",
        {"name": name.strip(), "description": description, "status": status,
         "start_date": start_date, "end_date": end_date, "id": project_id})
    db.commit()
    return get_project(db, user, project_id)


def delete_project(db: Db, user: dict, project_id: int) -> None:
    require_project_manager(db, user, project_id)
    files = [r["stored_name"] for r in db.query(
        "SELECT a.stored_name FROM attachments a JOIN tasks t ON t.task_id = a.task_id "
        "WHERE t.project_id = :p", {"p": project_id})]
    db.execute("DELETE FROM projects WHERE project_id = :p", {"p": project_id})  # cascades
    db.commit()
    storage.remove_quietly(files)


def add_member(db: Db, user: dict, project_id: int, member_id: int) -> dict:
    require_project_manager(db, user, project_id)
    target = db.one("SELECT user_id, is_active FROM users WHERE user_id = :u", {"u": member_id})
    if target is None:
        raise not_found("User not found")
    if not target["is_active"]:
        raise bad_request("Deactivated users cannot be added to a project",
                          userId="user is deactivated")
    if db.scalar("SELECT COUNT(*) FROM project_members WHERE project_id = :p AND user_id = :u",
                 {"p": project_id, "u": member_id}):
        raise conflict("User is already a member of this project")
    try:
        db.execute("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)",
                   {"p": project_id, "u": member_id})
    except Exception as exc:
        if is_unique_violation(exc):
            raise conflict("User is already a member of this project")
        raise
    db.commit()
    return next(m for m in list_members(db, project_id) if m["userId"] == member_id)


def remove_member(db: Db, user: dict, project_id: int, member_id: int) -> dict:
    """Remove a member AND their task assignments within this project only, returning a
    summary of what was unassigned (FR-014, FR-019, spec Edge Cases)."""
    require_project_manager(db, user, project_id)
    if not db.scalar("SELECT COUNT(*) FROM project_members WHERE project_id = :p AND user_id = :u",
                     {"p": project_id, "u": member_id}):
        raise not_found("User is not a member of this project")
    unassigned = db.query(
        """SELECT t.task_id, t.title FROM task_assignees ta JOIN tasks t ON t.task_id = ta.task_id
            WHERE t.project_id = :p AND ta.user_id = :u ORDER BY t.task_id""",
        {"p": project_id, "u": member_id})
    db.execute(
        """DELETE FROM task_assignees
            WHERE user_id = :u
              AND task_id IN (SELECT t.task_id FROM tasks t WHERE t.project_id = :p)""",
        {"u": member_id, "p": project_id})
    db.execute("DELETE FROM project_members WHERE project_id = :p AND user_id = :u",
               {"p": project_id, "u": member_id})
    db.commit()
    return {"projectId": project_id, "userId": member_id,
            "removedAssignments": len(unassigned),
            "unassignedTasks": [{"taskId": r["task_id"], "title": r["title"]} for r in unassigned]}


def progress(db: Db, user: dict, project_id: int) -> dict:
    require_project_visible(db, user, project_id)
    result = dashboard_repo.project_progress_one(db, user["user_id"], project_id)
    if result is None:
        raise not_found("Project not found")
    return result
