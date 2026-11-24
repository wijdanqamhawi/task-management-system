"""Soft delete and the Recycle Bin (isolated TMS_TEST schema only; see conftest.py).

world: admin = ADMIN, not a member | mgr = MANAGER, member | mgr_out = MANAGER, not a member
mem = MEMBER, assignee of t1 | mem2 = MEMBER, creator of t2 | outsider = MEMBER, not a member
target = MEMBER, not a member. t1 (assigned to mem, 3 attachment rows), t2, t3 in project ZZTEST rbac.
"""
import threading

from fastapi.testclient import TestClient

from app import db as appdb

PROGRESS = {"title": "ZZTEST step", "startAt": "2026-03-04T09:30", "endAt": "2026-03-06T17:00"}
CHILD_TABLES = ("subtasks", "comments", "attachments", "task_assignees", "notifications")


def _count(sql, **binds):
    with appdb.connection() as db:
        return db.scalar(sql, binds)


def _children(task_id):
    return {t: _count(f"SELECT COUNT(*) FROM {t} WHERE task_id = :t", t=task_id)
            for t in CHILD_TABLES}


def _sql(sql, **binds):
    with appdb.connection() as db:
        n = db.execute(sql, binds)
        db.commit()
        return n


def _bin(client, **params):
    resp = client.get("/api/recycle-bin/tasks", params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _bin_ids(client, **params):
    return [t["taskId"] for t in _bin(client, **params)["content"]]


def _populate(world):
    """Progress item + comment on t1 so every child table holds something."""
    c, t1 = world["c"], world["tasks"]["t1"]
    assert c["mgr"].post(f"/api/tasks/{t1}/subtasks", json=PROGRESS).status_code == 201
    assert c["mem"].post(f"/api/tasks/{t1}/comments", json={"body": "ZZTEST hello"}).status_code == 201


# ------------------------------------------------------------------ permissions

def test_member_cannot_delete_view_or_restore(world):
    c, tasks = world["c"], world["tasks"]
    for key in ("mem", "mem2", "outsider", "target"):
        assert c[key].delete(f"/api/tasks/{tasks['t2']}").status_code in (403, 404)
        assert c[key].get("/api/recycle-bin/tasks").status_code == 403
        assert c[key].post(f"/api/recycle-bin/tasks/{tasks['t2']}/restore").status_code == 403
    assert c["mem2"].delete(f"/api/tasks/{tasks['t2']}").status_code == 403    # creator, still no
    assert _count("SELECT COUNT(*) FROM tasks WHERE is_deleted = 'Y'") == 0


def test_manager_scope_and_admin_scope(world):
    c, tasks = world["c"], world["tasks"]
    assert c["mgr_out"].delete(f"/api/tasks/{tasks['t3']}").status_code == 404   # not a member
    assert c["mgr"].delete(f"/api/tasks/{tasks['t1']}").status_code == 204
    assert c["admin"].delete(f"/api/tasks/{tasks['t3']}").status_code == 204     # any project
    assert sorted(_bin_ids(c["mgr"])) == sorted([tasks["t1"], tasks["t3"]])
    assert sorted(_bin_ids(c["admin"])) == sorted([tasks["t1"], tasks["t3"]])
    assert _bin_ids(c["mgr_out"]) == []                                           # nothing in scope
    assert c["mgr_out"].post(f"/api/recycle-bin/tasks/{tasks['t1']}/restore").status_code == 404
    assert c["mgr"].post(f"/api/recycle-bin/tasks/{tasks['t1']}/restore").status_code == 200
    assert c["admin"].post(f"/api/recycle-bin/tasks/{tasks['t3']}/restore").status_code == 200


def test_bin_listing_shape_search_and_paging(world):
    c, tasks = world["c"], world["tasks"]
    for key in ("t1", "t2", "t3"):
        assert c["mgr"].delete(f"/api/tasks/{tasks[key]}").status_code == 204
    body = _bin(c["mgr"], size=2)
    assert body["totalElements"] == 3 and len(body["content"]) == 2 and body["totalPages"] == 2
    item = _bin(c["admin"], search="task 2")["content"][0]
    assert item["taskId"] == tasks["t2"] and item["title"] == "ZZTEST task 2"
    assert item["projectName"] == "ZZTEST rbac" and item["deletedByName"] == "ZZTEST mgr"
    assert item["deletedAt"] and item["deletedBy"] == world["ids"]["mgr"]
    assert len(_bin_ids(c["admin"], search="rbac")) == 3                           # matches project name
    assert _bin_ids(c["admin"], search="no-such-thing") == []
    assert _bin_ids(c["admin"], search="100%") == []                              # LIKE wildcards escaped
    assert c["admin"].get("/api/recycle-bin/tasks", params={"sort": "password"}).status_code == 400


# ------------------------------------------------------------------ soft delete preserves everything

def test_soft_delete_keeps_the_row_children_and_files(world):
    c, t1, ids = world["c"], world["tasks"]["t1"], world["ids"]
    _populate(world)
    before = _children(t1)
    assert before["subtasks"] == 1 and before["comments"] == 1
    assert before["attachments"] == 3 and before["task_assignees"] == 1
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    assert _children(t1) == before
    with appdb.connection() as db:
        row = db.one("SELECT is_deleted, deleted_at, deleted_by FROM tasks WHERE task_id = :t",
                     {"t": t1})
        audit = db.query("SELECT action, actor_id, task_title FROM task_audit_log "
                         "WHERE task_id = :t", {"t": t1})
    assert row["is_deleted"] is True and row["deleted_at"] and row["deleted_by"] == ids["mgr"]
    assert audit == [{"action": "DELETE", "actor_id": ids["mgr"], "task_title": "ZZTEST task 1"}]


def test_deleting_twice_is_a_404_and_audits_once(world):
    c, t1 = world["c"], world["tasks"]["t1"]
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 404
    assert c["admin"].delete(f"/api/tasks/{t1}").status_code == 404
    assert _count("SELECT COUNT(*) FROM task_audit_log WHERE task_id = :t", t=t1) == 1


# ------------------------------------------------------------------ deleted tasks are gone from normal views

def test_deleted_task_is_a_404_everywhere_and_absent_from_lists(world):
    c, ids, t1 = world["c"], world["ids"], world["tasks"]["t1"]
    _populate(world)
    note = _count("SELECT COUNT(*) FROM notifications WHERE task_id = :t", t=t1)
    assert note >= 1                                   # mem's comment notified the creator (mgr)
    assert t1 in [n["taskId"] for n in c["mgr"].get(
        "/api/notifications", params={"size": 100}).json()["content"]]
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    for key in ("admin", "mgr", "mem"):                                    # direct access: 404
        cl = c[key]
        assert cl.get(f"/api/tasks/{t1}").status_code == 404
        assert cl.put(f"/api/tasks/{t1}", json={"title": "ZZTEST x"}).status_code == 404
        assert cl.patch(f"/api/tasks/{t1}/status", json={"status": "REVIEW"}).status_code == 404
        assert cl.post(f"/api/tasks/{t1}/assignees", json={"userIds": [ids["mem2"]]}).status_code == 404
        assert cl.delete(f"/api/tasks/{t1}/assignees/{ids['mem']}").status_code == 404
        assert cl.get(f"/api/tasks/{t1}/subtasks").status_code == 404
        assert cl.post(f"/api/tasks/{t1}/subtasks", json=PROGRESS).status_code == 404
        assert cl.get(f"/api/tasks/{t1}/comments").status_code == 404
        assert cl.post(f"/api/tasks/{t1}/comments", json={"body": "ZZTEST no"}).status_code == 404
        assert cl.get(f"/api/tasks/{t1}/attachments").status_code == 404
    sid = _count("SELECT subtask_id FROM subtasks WHERE task_id = :t", t=t1)
    aid = _count("SELECT MIN(attachment_id) FROM attachments WHERE task_id = :t", t=t1)
    assert c["mgr"].put(f"/api/subtasks/{sid}", json={"title": "ZZTEST y"}).status_code == 404
    assert c["mem"].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": True}).status_code == 404
    assert c["mgr"].delete(f"/api/subtasks/{sid}").status_code == 404
    assert c["mgr"].get(f"/api/attachments/{aid}").status_code == 404
    assert c["mgr"].delete(f"/api/attachments/{aid}").status_code == 404

    for key in ("admin", "mgr", "mem", "mem2"):                            # lists and search
        for path in ("/api/tasks", "/api/tasks/assigned-to-me", "/api/tasks/shared-with-me"):
            got = c[key].get(path, params={"size": 100}).json()["content"]
            assert t1 not in [t["taskId"] for t in got], (key, path)
    assert c["admin"].get("/api/tasks", params={"title": "task 1"}).json()["content"] == []
    assert t1 not in [t["taskId"] for t in c["mgr"].get(
        "/api/tasks", params={"projectId": world["project"], "size": 100}).json()["content"]]
    # Notifications stay in the database (preserved) but are hidden from the user.
    assert _count("SELECT COUNT(*) FROM notifications WHERE task_id = :t", t=t1) == note
    assert t1 not in [n["taskId"] for n in c["mgr"].get(
        "/api/notifications", params={"size": 100}).json()["content"]]
    assert c["mgr"].get("/api/notifications/unread-count").json()["unreadCount"] == 0
    # Nothing was written to the deleted task by the refused calls above.
    with appdb.connection() as db:
        row = db.one("SELECT title FROM tasks WHERE task_id = :t", {"t": t1})
    assert row["title"] == "ZZTEST task 1"


def test_dashboard_statistics_exclude_deleted_tasks(world):
    c, t1 = world["c"], world["tasks"]["t1"]
    before = c["mgr"].get("/api/dashboard").json()
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    after = c["mgr"].get("/api/dashboard").json()
    assert after["totalTasks"] == before["totalTasks"] - 1
    assert after["pendingTasks"] == before["pendingTasks"] - 1
    assert after["tasksByStatus"]["TO_DO"] == before["tasksByStatus"]["TO_DO"] - 1
    assert after["tasksByPriority"]["MEDIUM"] == before["tasksByPriority"]["MEDIUM"] - 1
    assert sum(u["taskCount"] for u in after["tasksByUser"]) == \
        sum(u["taskCount"] for u in before["tasksByUser"]) - 1               # t1's assignment
    mine = next(p for p in after["projectProgress"] if p["projectId"] == world["project"])
    assert mine["totalTasks"] == 2
    assert c["mgr"].get(f"/api/projects/{world['project']}/progress").json()["totalTasks"] == 2
    # A project whose tasks are all deleted still appears, with zero tasks.
    for key in ("t2", "t3"):
        assert c["mgr"].delete(f"/api/tasks/{world['tasks'][key]}").status_code == 204
    empty = next(p for p in c["mgr"].get("/api/dashboard").json()["projectProgress"]
                 if p["projectId"] == world["project"])
    assert empty["totalTasks"] == 0 and empty["percentComplete"] == 0


# ------------------------------------------------------------------ restore

def test_restore_brings_back_the_task_and_everything_on_it(world):
    c, t1, ids = world["c"], world["tasks"]["t1"], world["ids"]
    _populate(world)
    before = _children(t1)
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    resp = c["admin"].post(f"/api/recycle-bin/tasks/{t1}/restore")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["removedAssignees"] == [] and body["task"]["taskId"] == t1
    assert [a["userId"] for a in body["task"]["assignees"]] == [ids["mem"]]
    assert c["mem"].get(f"/api/tasks/{t1}").status_code == 200
    assert len(c["mem"].get(f"/api/tasks/{t1}/subtasks").json()) == 1
    assert len(c["mem"].get(f"/api/tasks/{t1}/comments").json()) == 1
    assert len(c["mem"].get(f"/api/tasks/{t1}/attachments").json()) == 3
    assert t1 in [t["taskId"] for t in c["mem"].get("/api/tasks/assigned-to-me").json()["content"]]
    assert _bin_ids(c["admin"]) == []
    with appdb.connection() as db:
        row = db.one("SELECT is_deleted, deleted_at, deleted_by FROM tasks WHERE task_id = :t",
                     {"t": t1})
        actions = [a["action"] for a in db.query(
            "SELECT action FROM task_audit_log WHERE task_id = :t ORDER BY audit_id", {"t": t1})]
    assert row == {"is_deleted": False, "deleted_at": None, "deleted_by": None}
    assert actions == ["DELETE", "RESTORE"]                                  # history is kept
    assert {k: v for k, v in _children(t1).items() if k != "notifications"} == \
        {k: v for k, v in before.items() if k != "notifications"}


def test_restore_unassigns_and_reports_ineligible_assignees(world):
    c, t1, ids, pid = world["c"], world["tasks"]["t1"], world["ids"], world["project"]
    # mem2 stays eligible; mem is deactivated; target is assigned then removed from the project.
    assert c["mgr"].post(f"/api/tasks/{t1}/assignees", json={"userIds": [ids["mem2"]]}).status_code == 200
    _sql("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)", p=pid, u=ids["target"])
    assert c["mgr"].post(f"/api/tasks/{t1}/assignees", json={"userIds": [ids["target"]]}).status_code == 200
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    _sql("DELETE FROM project_members WHERE project_id = :p AND user_id = :u", p=pid, u=ids["target"])
    _sql("UPDATE users SET is_active = 'N' WHERE user_id = :u", u=ids["mem"])
    # Deleted tasks keep their assignments while in the bin (all three).
    assert _children(t1)["task_assignees"] == 3

    resp = c["mgr"].post(f"/api/recycle-bin/tasks/{t1}/restore")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    reasons = {r["userId"]: r["reason"] for r in body["removedAssignees"]}
    assert reasons == {ids["mem"]: "account is deactivated",
                       ids["target"]: "no longer a member of the project"}
    assert [a["userId"] for a in body["task"]["assignees"]] == [ids["mem2"]]
    assert _children(t1)["task_assignees"] == 1
    with appdb.connection() as db:
        details = db.scalar("SELECT details FROM task_audit_log WHERE task_id = :t AND action = 'RESTORE'",
                            {"t": t1})
    assert "ZZTEST mem" in details and "ZZTEST target" in details


def test_restoring_a_task_that_is_not_deleted_or_twice_is_a_404(world):
    c, t1 = world["c"], world["tasks"]["t1"]
    assert c["mgr"].post(f"/api/recycle-bin/tasks/{t1}/restore").status_code == 404   # live
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    assert c["mgr"].post(f"/api/recycle-bin/tasks/{t1}/restore").status_code == 200
    assert c["mgr"].post(f"/api/recycle-bin/tasks/{t1}/restore").status_code == 404
    assert c["mgr"].post("/api/recycle-bin/tasks/999999999/restore").status_code == 404
    assert _count("SELECT COUNT(*) FROM task_audit_log WHERE task_id = :t AND action = 'RESTORE'",
                  t=t1) == 1


# ------------------------------------------------------------------ project deletion and membership

def test_project_with_tasks_in_the_bin_cannot_be_deleted(world):
    c, t1, pid = world["c"], world["tasks"]["t1"], world["project"]
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    for key in ("mgr", "admin"):
        resp = c[key].delete(f"/api/projects/{pid}")
        assert resp.status_code == 409 and "Recycle Bin" in resp.json()["message"]
    assert _count("SELECT COUNT(*) FROM projects WHERE project_id = :p", p=pid) == 1
    assert _count("SELECT COUNT(*) FROM tasks WHERE task_id = :t", t=t1) == 1        # recoverable
    assert c["mgr"].post(f"/api/recycle-bin/tasks/{t1}/restore").status_code == 200
    assert c["admin"].delete(f"/api/projects/{pid}").status_code == 204             # now allowed


def test_removing_a_member_keeps_assignments_of_deleted_tasks(world):
    c, t1, ids, pid = world["c"], world["tasks"]["t1"], world["ids"], world["project"]
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    assert c["admin"].delete(f"/api/projects/{pid}/members/{ids['mem']}").status_code == 200
    assert _children(t1)["task_assignees"] == 1                  # preserved while deleted
    resp = c["admin"].post(f"/api/recycle-bin/tasks/{t1}/restore")
    assert [r["userId"] for r in resp.json()["removedAssignees"]] == [ids["mem"]]
    assert _children(t1)["task_assignees"] == 0


# ------------------------------------------------------------------ concurrency

def _race(*calls):
    """Run the callables at the same moment on separate threads; return their results."""
    barrier, out = threading.Barrier(len(calls)), [None] * len(calls)

    def run(i, fn):
        barrier.wait()
        out[i] = fn()

    threads = [threading.Thread(target=run, args=(i, fn)) for i, fn in enumerate(calls)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return out


def _fresh(world, key):
    """A separate client (own session) for the same user, so threads do not share a cookie jar."""
    client = TestClient(world["c"][key].app)
    client.cookies.update(world["c"][key].cookies)
    return client


def test_concurrent_deletes_and_restores_have_exactly_one_winner(world):
    t1 = world["tasks"]["t1"]
    a, b = _fresh(world, "mgr"), _fresh(world, "admin")
    first = _race(lambda: a.delete(f"/api/tasks/{t1}").status_code,
                  lambda: b.delete(f"/api/tasks/{t1}").status_code)
    assert sorted(first) == [204, 404]
    assert _count("SELECT COUNT(*) FROM task_audit_log WHERE task_id = :t AND action = 'DELETE'",
                  t=t1) == 1
    second = _race(lambda: a.post(f"/api/recycle-bin/tasks/{t1}/restore").status_code,
                   lambda: b.post(f"/api/recycle-bin/tasks/{t1}/restore").status_code)
    assert 200 in second and sorted(second)[1] in (404, 409)
    assert _count("SELECT COUNT(*) FROM task_audit_log WHERE task_id = :t AND action = 'RESTORE'",
                  t=t1) == 1


def _assert_no_ineligible_assignee_on_live_tasks(pid):
    bad = _count(
        """SELECT COUNT(*) FROM task_assignees ta JOIN tasks t ON t.task_id = ta.task_id
            WHERE t.project_id = :p AND t.is_deleted = 'N'
              AND NOT EXISTS (SELECT 1 FROM project_members pm
                               WHERE pm.project_id = t.project_id AND pm.user_id = ta.user_id)""",
        p=pid)
    assert bad == 0


def test_restore_racing_member_removal_never_leaves_a_removed_user_assigned(world):
    c, t1, ids, pid = world["c"], world["tasks"]["t1"], world["ids"], world["project"]
    assert c["mgr"].delete(f"/api/tasks/{t1}").status_code == 204
    a, b = _fresh(world, "mgr"), _fresh(world, "admin")
    results = _race(lambda: a.post(f"/api/recycle-bin/tasks/{t1}/restore").status_code,
                    lambda: b.delete(f"/api/projects/{pid}/members/{ids['mem']}").status_code)
    assert results[0] == 200 and results[1] == 200
    _assert_no_ineligible_assignee_on_live_tasks(pid)
    assert _count("SELECT COUNT(*) FROM tasks WHERE task_id = :t AND is_deleted = 'N'", t=t1) == 1


def test_assign_racing_member_removal_never_assigns_a_removed_user(world):
    c, t3, ids, pid = world["c"], world["tasks"]["t3"], world["ids"], world["project"]
    a, b = _fresh(world, "mgr"), _fresh(world, "admin")
    results = _race(lambda: a.post(f"/api/tasks/{t3}/assignees",
                                   json={"userIds": [ids["mem2"]]}).status_code,
                    lambda: b.delete(f"/api/projects/{pid}/members/{ids['mem2']}").status_code)
    assert results[1] == 200 and results[0] in (200, 400)    # 400: removal won, not a member now
    _assert_no_ineligible_assignee_on_live_tasks(pid)


def test_assign_racing_delete_never_changes_a_deleted_task(world):
    c, t3, ids = world["c"], world["tasks"]["t3"], world["ids"]
    a, b = _fresh(world, "mgr"), _fresh(world, "admin")
    results = _race(lambda: a.post(f"/api/tasks/{t3}/assignees",
                                   json={"userIds": [ids["mem2"]]}).status_code,
                    lambda: b.delete(f"/api/tasks/{t3}").status_code)
    assert results[1] == 204 and results[0] in (200, 404)
    # Either order is consistent: the task is deleted, and an assignment made before the delete
    # is simply preserved with it.
    assert _count("SELECT COUNT(*) FROM tasks WHERE task_id = :t AND is_deleted = 'Y'", t=t3) == 1
