"""User performance: completion and schedule adherence, computed per request from TASKS.

Schedule per completed task (whole calendar days):
    plannedDuration    = dueDate - startDate
    actualDuration     = completedAt - startDate
    scheduleDifference = actualDuration - plannedDuration      (< 0 early, 0 on time, > 0 late)
A completed task without startDate, dueDate or completedAt (e.g. completed before completed_at
existed) is "Not evaluable": it counts as completed but never enters the schedule figures.
No composite score is produced; every figure is a plain count or ratio.

Scope: only tasks the caller may see (`task_visibility_clause`), so a MANAGER sees a user's
tasks in their own projects and an ADMIN sees all. Viewing another user needs TASK_ASSIGN or
PROJECT_VIEW_ALL; no permission is added.
"""
from datetime import date, datetime

from app.common.access import task_visibility_clause
from app.common.permissions import PROJECT_VIEW_ALL, TASK_ASSIGN, has_permission
from app.db import Db
from app.errors import forbidden, not_found

EARLY, ON_TIME, LATE, NOT_EVALUABLE = "EARLY", "ON_TIME", "LATE", "NOT_EVALUABLE"


def _day(value) -> date | None:
    return value.date() if isinstance(value, datetime) else value


def schedule_label(difference: float) -> str:
    """'5 days early', 'On time', '1 day late'. Fractions only occur in averages."""
    if difference == 0:
        return "On time"
    n = abs(difference)
    n = int(n) if float(n).is_integer() else round(n, 1)
    return f"{n} {'day' if n == 1 else 'days'} {'early' if difference < 0 else 'late'}"


def task_schedule(status: str, start, due, completed) -> dict:
    """Schedule figures for one task; the numeric fields are None unless it is evaluable."""
    start, due, completed = _day(start), _day(due), _day(completed)
    planned = (due - start).days if start and due else None
    out = {"plannedDuration": planned, "actualDuration": None, "scheduleDifference": None,
           "scheduleStatus": NOT_EVALUABLE, "scheduleLabel": "Not evaluable"}
    if status != "COMPLETED" or planned is None or completed is None:
        return out
    actual = (completed - start).days
    diff = actual - planned
    out.update(actualDuration=actual, scheduleDifference=diff,
               scheduleStatus=EARLY if diff < 0 else ON_TIME if diff == 0 else LATE,
               scheduleLabel=schedule_label(diff))
    return out


def _rate(numerator: int, denominator: int) -> float | None:
    return round(100 * numerator / denominator, 1) if denominator else None


def summarize(tasks: list[dict]) -> dict:
    """Per-user metrics from the per-task rows built by `_task_row`."""
    completed = [t for t in tasks if t["status"] == "COMPLETED"]
    evaluable = [t for t in completed if t["scheduleStatus"] != NOT_EVALUABLE]
    early = sum(1 for t in evaluable if t["scheduleStatus"] == EARLY)
    on_time = sum(1 for t in evaluable if t["scheduleStatus"] == ON_TIME)
    late = sum(1 for t in evaluable if t["scheduleStatus"] == LATE)
    average = (round(sum(t["scheduleDifference"] for t in evaluable) / len(evaluable), 1)
               if evaluable else None)
    return {
        "totalAssignedTasks": len(tasks),
        "totalCompletedTasks": len(completed),
        "completionRate": _rate(len(completed), len(tasks)),
        "evaluableCompletedTasks": len(evaluable),
        "notEvaluableCompletedTasks": len(completed) - len(evaluable),
        "earlyTasks": early,
        "onTimeTasks": on_time,
        "lateTasks": late,
        "onTimeRate": _rate(early + on_time, len(evaluable)),
        "averageScheduleDifference": average,
        "averageScheduleLabel": None if average is None else schedule_label(average),
        "summary": _summary_text(len(tasks), len(completed), len(evaluable), early + on_time,
                                 average),
    }


def _summary_text(assigned: int, completed: int, evaluable: int, on_time: int,
                  average: float | None) -> str:
    if assigned == 0:
        return "No assigned tasks yet."
    text = f"{completed} of {assigned} assigned tasks completed ({round(100 * completed / assigned)}%)."
    if evaluable:
        text += (f" {on_time} of {evaluable} evaluable completed tasks finished on time or early"
                 f" ({round(100 * on_time / evaluable)}%); on average "
                 f"{schedule_label(average).lower()}.")
    elif completed:
        text += " No completed task has enough timing data to evaluate its schedule."
    return text


def _progress(total, done, status: str) -> int:
    """Subtask progress; a task without subtasks is 100 when COMPLETED and 0 otherwise."""
    total, done = int(total or 0), int(done or 0)
    if total == 0:
        return 100 if status == "COMPLETED" else 0
    return round(100 * done / total)


def _task_row(r: dict) -> dict:
    return {
        "taskId": r["task_id"], "title": r["title"], "projectId": r["project_id"],
        "projectName": r["project_name"], "status": r["status"],
        "startDate": _day(r["start_date"]), "dueDate": _day(r["due_date"]),
        "completedAt": _day(r["completed_at"]),
        "progressPercent": _progress(r["subtasks_total"], r["subtasks_done"], r["status"]),
        **task_schedule(r["status"], r["start_date"], r["due_date"], r["completed_at"]),
    }


def _assigned_tasks(db: Db, viewer: dict, user_id: int) -> list[dict]:
    clause, binds = task_visibility_clause(viewer, "t")
    rows = db.query(
        f"""SELECT t.task_id, t.title, t.project_id, p.name AS project_name,
                   s.status_code AS status, t.start_date, t.due_date, t.completed_at,
                   (SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.task_id) AS subtasks_total,
                   (SELECT COUNT(*) FROM subtasks st WHERE st.task_id = t.task_id
                       AND st.is_completed = 'Y') AS subtasks_done
              FROM tasks t
              JOIN task_assignees ta ON ta.task_id = t.task_id AND ta.user_id = :target
              JOIN projects p        ON p.project_id = t.project_id
              JOIN task_status s     ON s.status_id  = t.status_id
             WHERE {clause}
             ORDER BY t.due_date NULLS LAST, t.task_id""",
        {"target": user_id, **binds})
    return [_task_row(r) for r in rows]


def _require_may_view(db: Db, viewer: dict, user_id: int) -> None:
    if user_id == viewer["user_id"]:
        return
    if not (has_permission(viewer, TASK_ASSIGN) or has_permission(viewer, PROJECT_VIEW_ALL)):
        raise forbidden()
    # Without PROJECT_VIEW_ALL the user must share a project with the viewer; anyone else is
    # reported as absent, like an invisible task.
    if not has_permission(viewer, PROJECT_VIEW_ALL) and not db.scalar(
            """SELECT COUNT(*) FROM project_members a JOIN project_members b
                 ON a.project_id = b.project_id
                WHERE a.user_id = :v AND b.user_id = :u""",
            {"v": viewer["user_id"], "u": user_id}):
        raise not_found("User not found")


def user_performance(db: Db, viewer: dict, user_id: int) -> dict:
    target = db.one("SELECT user_id, full_name FROM users WHERE user_id = :u", {"u": user_id})
    if target is None:
        raise not_found("User not found")
    _require_may_view(db, viewer, user_id)
    tasks = _assigned_tasks(db, viewer, user_id)
    completed = [t for t in tasks if t["status"] == "COMPLETED"]
    return {"userId": target["user_id"], "fullName": target["full_name"],
            **summarize(tasks), "completedTasks": completed}
