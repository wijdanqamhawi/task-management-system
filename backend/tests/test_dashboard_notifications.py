"""US6 dashboard accuracy and visibility; US8 notifications (FR-036..FR-045, FR-054..FR-061).

Dashboard figures are compared with direct SQL counts (SC-005), so they stay correct whatever
the demo data currently holds.
"""
import pytest

from app.modules.notifications import scheduler
from tests.conftest import ADMIN, INACTIVE, MANAGER, MEMBER, MEMBER_OTHER, user_id

OVERDUE = "s.status_code <> 'COMPLETED' AND t.due_date < TRUNC(SYSDATE)"
TASKS = "FROM tasks t JOIN task_status s ON s.status_id = t.status_id"


def expected_for_admin(db):
    return {
        "totalProjects": db.scalar("SELECT COUNT(*) FROM projects"),
        "totalTasks": db.scalar(f"SELECT COUNT(*) {TASKS}"),
        "completedTasks": db.scalar(f"SELECT COUNT(*) {TASKS} WHERE s.status_code = 'COMPLETED'"),
        "pendingTasks": db.scalar(f"SELECT COUNT(*) {TASKS} WHERE s.status_code <> 'COMPLETED'"),
        "overdueTasks": db.scalar(f"SELECT COUNT(*) {TASKS} WHERE {OVERDUE}"),
    }


def test_dashboard_matches_direct_sql_for_admin(login, dbc):
    r = login(ADMIN).get("/api/dashboard")
    assert r.status_code == 200, r.text
    body = r.json()
    for key, value in expected_for_admin(dbc).items():
        assert body[key] == value, key
    assert body["pendingTasks"] + body["completedTasks"] == body["totalTasks"]
    by_status = {r["status_code"]: r["n"] for r in dbc.query(
        f"SELECT s.status_code, COUNT(*) AS n {TASKS} GROUP BY s.status_code")}
    assert body["tasksByStatus"] == {k: by_status.get(k, 0) for k in
                                     ("TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED")}
    assert sum(body["tasksByPriority"].values()) == body["totalTasks"]
    assert set(body["tasksByPriority"]) == {"LOW", "MEDIUM", "HIGH"}
    by_user = {r["user_id"]: r["n"] for r in dbc.query(
        "SELECT user_id, COUNT(*) AS n FROM task_assignees GROUP BY user_id")}
    assert {u["userId"]: u["taskCount"] for u in body["tasksByUser"]} == by_user
    assert len(body["projectProgress"]) == body["totalProjects"]
    for p in body["projectProgress"]:
        assert p["percentComplete"] == (round(100 * p["completedTasks"] / p["totalTasks"])
                                        if p["totalTasks"] else 0)


def test_dashboard_for_a_member_counts_only_their_projects(login, dbc):
    client = login(MEMBER)
    uid = user_id(client)
    visible = ("EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id "
               "AND pm.user_id = :u)")
    body = client.get("/api/dashboard").json()
    assert body["totalTasks"] == dbc.scalar(f"SELECT COUNT(*) {TASKS} WHERE {visible}", {"u": uid})
    assert body["totalProjects"] == dbc.scalar(
        "SELECT COUNT(*) FROM project_members WHERE user_id = :u", {"u": uid})
    assert body["overdueTasks"] == dbc.scalar(
        f"SELECT COUNT(*) {TASKS} WHERE {OVERDUE} AND {visible}", {"u": uid})
    assert {p["projectId"] for p in body["projectProgress"]} == {r["project_id"] for r in dbc.query(
        "SELECT project_id FROM project_members WHERE user_id = :u", {"u": uid})}


def test_dashboard_requires_authentication(anon):
    assert anon.get("/api/dashboard").status_code == 401


# ------------------------------------------------------------------ notifications

@pytest.fixture()
def team(login, new_project):
    manager, member = login(MANAGER), login(MEMBER)
    project = new_project(manager, [user_id(member)])
    return {"manager": manager, "member": member, "pid": project["projectId"],
            "mid": user_id(member), "manager_id": user_id(manager)}


def unread(client):
    return client.get("/api/notifications", params={"unreadOnly": True, "size": 100}).json()["content"]


def test_assignment_notifies_the_assignee_once_and_not_the_actor(team):
    task = team["manager"].post("/api/tasks", json={
        "projectId": team["pid"], "title": "ZZTEST n1",
        "assigneeIds": [team["mid"], team["manager_id"]]}).json()
    mine = [n for n in unread(team["member"]) if n["taskId"] == task["taskId"]]
    assert len(mine) == 1 and mine[0]["triggerType"] == "ASSIGNMENT"
    assert [n for n in unread(team["manager"]) if n["taskId"] == task["taskId"]] == []   # actor


def test_status_change_notifies_involved_users_with_update(team):
    tid = team["manager"].post("/api/tasks", json={
        "projectId": team["pid"], "title": "ZZTEST n2", "assigneeIds": [team["mid"]]}).json()["taskId"]
    team["member"].put("/api/notifications/read-all")
    team["manager"].patch(f"/api/tasks/{tid}/status", json={"status": "REVIEW"})
    got = [n for n in unread(team["member"]) if n["taskId"] == tid]
    assert [n["triggerType"] for n in got] == ["UPDATE"] and "Review" in got[0]["message"]


def test_comment_and_mention_notifications(team, login):
    tid = team["manager"].post("/api/tasks", json={
        "projectId": team["pid"], "title": "ZZTEST n3", "assigneeIds": [team["mid"]]}).json()["taskId"]
    team["member"].put("/api/notifications/read-all")
    team["manager"].post(f"/api/tasks/{tid}/comments", json={"body": "plain comment"})
    got = [n for n in unread(team["member"]) if n["taskId"] == tid]
    assert [n["triggerType"] for n in got] == ["COMMENT"]
    team["member"].put("/api/notifications/read-all")
    team["manager"].post(f"/api/tasks/{tid}/comments", json={"body": "hey @a.hassan look"})
    got = [n for n in unread(team["member"]) if n["taskId"] == tid]
    assert len(got) == 1 and "mentioned" in got[0]["message"]        # one, not two


def test_no_notification_for_deactivated_user_or_non_member(team, login, dbc):
    admin = login(ADMIN)
    team["manager"].post(f"/api/projects/{team['pid']}/members", json={"userId": user_id(admin)})
    # Deactivate the member, then assign them: nothing may be raised for them (FR-061).
    dbc.execute("UPDATE users SET is_active = 'N' WHERE user_id = :u", {"u": team["mid"]})
    dbc.commit()
    try:
        tid = team["manager"].post("/api/tasks", json={
            "projectId": team["pid"], "title": "ZZTEST n4"}).json()["taskId"]
        from app.modules.notifications import service
        service.notify(dbc, task={"task_id": tid, "project_id": team["pid"]},
                       recipient_ids=[team["mid"], user_id(login(MEMBER_OTHER))],
                       trigger_type="UPDATE", message="x", actor_id=None)
        dbc.commit()
        assert dbc.scalar("SELECT COUNT(*) FROM notifications WHERE task_id = :t", {"t": tid}) == 0
    finally:
        dbc.execute("UPDATE users SET is_active = 'Y' WHERE user_id = :u", {"u": team["mid"]})
        dbc.commit()


def test_read_unread_count_read_all_and_privacy(team, login):
    team["manager"].post("/api/tasks", json={"projectId": team["pid"], "title": "ZZTEST n5",
                                             "assigneeIds": [team["mid"]]})
    member = team["member"]
    first = unread(member)[0]
    count = member.get("/api/notifications/unread-count").json()["unreadCount"]
    assert count == len(unread(member)) and count >= 1
    assert team["manager"].put(f"/api/notifications/{first['notificationId']}/read").status_code == 404
    ok = member.put(f"/api/notifications/{first['notificationId']}/read")
    assert ok.status_code == 200 and ok.json()["isRead"] is True
    assert member.get("/api/notifications/unread-count").json()["unreadCount"] == count - 1
    assert member.put("/api/notifications/read-all").status_code == 200
    assert member.get("/api/notifications/unread-count").json()["unreadCount"] == 0


def test_scheduled_generation_is_idempotent(team, dbc):
    """The single most important notification assertion (R-007): running the job twice over an
    approaching-deadline task and an overdue task raises exactly one notification each."""
    mgr, mid, pid = team["manager"], team["mid"], team["pid"]
    soon = mgr.post("/api/tasks", json={"projectId": pid, "title": "ZZTEST soon", "assigneeIds": [mid]}).json()["taskId"]
    late = mgr.post("/api/tasks", json={"projectId": pid, "title": "ZZTEST late", "assigneeIds": [mid]}).json()["taskId"]
    done = mgr.post("/api/tasks", json={"projectId": pid, "title": "ZZTEST done", "assigneeIds": [mid]}).json()["taskId"]
    dbc.execute("UPDATE tasks SET due_date = TRUNC(SYSDATE) + 1 WHERE task_id = :t", {"t": soon})
    dbc.execute("UPDATE tasks SET due_date = TRUNC(SYSDATE) - 3 WHERE task_id = :t", {"t": late})
    dbc.execute("UPDATE tasks SET due_date = TRUNC(SYSDATE) - 3 WHERE task_id = :t", {"t": done})
    dbc.commit()
    mgr.patch(f"/api/tasks/{done}/status", json={"status": "COMPLETED"})

    # The package scans EVERY task in the schema, so it also raises notifications for the demo
    # data. Remember where the table stood and remove only what this test caused.
    before = dbc.scalar("SELECT NVL(MAX(notification_id), 0) FROM notifications")
    try:
        scheduler.run_once()
        scheduler.run_once()
        _assert_once_each(dbc, mid, soon, late, done)
    finally:
        dbc.execute("DELETE FROM notifications WHERE notification_id > :b", {"b": before})
        dbc.commit()


def _assert_once_each(dbc, mid, soon, late, done):

    def count(task, trigger):
        return dbc.scalar("SELECT COUNT(*) FROM notifications WHERE task_id = :t AND "
                          "recipient_id = :r AND trigger_type = :tt",
                          {"t": task, "r": mid, "tt": trigger})
    assert count(soon, "DEADLINE") == 1 and count(soon, "OVERDUE") == 0
    assert count(late, "OVERDUE") == 1 and count(late, "DEADLINE") == 0
    assert count(done, "OVERDUE") == 0 and count(done, "DEADLINE") == 0     # completed: skipped
