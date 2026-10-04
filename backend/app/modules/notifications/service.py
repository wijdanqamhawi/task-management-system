"""In-app notifications (FR-054..FR-061). Optional in the official document; [CLARIFIED] in scope.

The three action-driven triggers (ASSIGNMENT, UPDATE, COMMENT) are written here, inside the
transaction of the action that causes them (R-007), so a rolled-back action leaves no
notification. The two date-driven triggers (DEADLINE, OVERDUE) come from PKG_NOTIFICATION.
"""
from app.common.access import task_visibility_clause
from app.common.paging import PageParams, page_response
from app.db import Db
from app.errors import not_found

ASSIGNMENT, UPDATE, COMMENT = "ASSIGNMENT", "UPDATE", "COMMENT"


def notify(db: Db, *, task: dict, recipient_ids, trigger_type: str, message: str,
           actor_id: int | None) -> int:
    """Create one notification per eligible recipient. Does not commit.

    Eligible = not the actor, an ACTIVE account (FR-061), and permitted to see the task's
    project (FR-061: a notification must never disclose an invisible task).
    """
    ids = sorted({int(i) for i in recipient_ids if i is not None and i != actor_id})
    if not ids:
        return 0
    binds = {f"r{n}": uid for n, uid in enumerate(ids)}
    in_list = ", ".join(f":{k}" for k in binds)
    eligible = db.query(
        f"""SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id IN ({in_list}) AND u.is_active = 'Y'
               AND (r.role_name = 'ADMIN' OR EXISTS (
                      SELECT 1 FROM project_members pm
                       WHERE pm.project_id = :project_id AND pm.user_id = u.user_id))""",
        {**binds, "project_id": task["project_id"]})
    for row in eligible:
        db.execute(
            "INSERT INTO notifications (recipient_id, task_id, trigger_type, message) "
            "VALUES (:r, :t, :tt, :m)",
            {"r": row["user_id"], "t": task["task_id"], "tt": trigger_type,
             "m": message[:500]})
    return len(eligible)


def _view(row: dict) -> dict:
    return {
        "notificationId": row["notification_id"],
        "taskId": row["task_id"],
        "triggerType": row["trigger_type"],
        "message": row["message"],
        "isRead": row["is_read"],
        "createdAt": row["created_at"],
    }


def _visible_clause(user: dict) -> tuple[str, dict]:
    clause, binds = task_visibility_clause(user, "t")
    return f"(n.task_id IS NULL OR {clause})", binds


def list_for(db: Db, user: dict, params: PageParams, unread_only: bool) -> dict:
    vis, binds = _visible_clause(user)
    where = f"n.recipient_id = :me AND {vis}" + (" AND n.is_read = 'N'" if unread_only else "")
    binds = {**binds, "me": user["user_id"]}
    frm = "FROM notifications n LEFT JOIN tasks t ON t.task_id = n.task_id"
    total = db.scalar(f"SELECT COUNT(*) {frm} WHERE {where}", binds)
    rows = db.query(
        f"""SELECT n.notification_id, n.task_id, n.trigger_type, n.message, n.is_read, n.created_at
             {frm} WHERE {where}
             ORDER BY n.created_at DESC, n.notification_id DESC
            OFFSET :off ROWS FETCH NEXT :sz ROWS ONLY""",
        {**binds, "off": params.offset, "sz": params.size})
    return page_response([_view(r) for r in rows], params, total)


def unread_count(db: Db, user: dict) -> dict:
    vis, binds = _visible_clause(user)
    n = db.scalar(
        f"SELECT COUNT(*) FROM notifications n LEFT JOIN tasks t ON t.task_id = n.task_id "
        f"WHERE n.recipient_id = :me AND n.is_read = 'N' AND {vis}",
        {**binds, "me": user["user_id"]})
    return {"unreadCount": n}


def mark_read(db: Db, user: dict, notification_id: int) -> dict:
    row = db.one(
        "SELECT notification_id, task_id, trigger_type, message, is_read, created_at "
        "FROM notifications WHERE notification_id = :id AND recipient_id = :me",
        {"id": notification_id, "me": user["user_id"]})
    if row is None:
        raise not_found("Notification not found")      # another user's -> 404 (FR-061)
    db.execute("UPDATE notifications SET is_read = 'Y' WHERE notification_id = :id",
               {"id": notification_id})
    db.commit()
    row["is_read"] = True
    return _view(row)


def mark_all_read(db: Db, user: dict) -> dict:
    n = db.execute("UPDATE notifications SET is_read = 'Y' "
                   "WHERE recipient_id = :me AND is_read = 'N'", {"me": user["user_id"]})
    db.commit()
    return {"updated": n}
