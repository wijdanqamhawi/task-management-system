"""US3, US4, US7: tasks, assignment, status workflow, sharing, search (FR-016..FR-035a,
FR-046..FR-053)."""
import pytest

from tests.conftest import ADMIN, MANAGER, MEMBER, MEMBER_OTHER, user_id

STATUSES = ["TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED"]


@pytest.fixture()
def world(login, new_project):
    manager, member, outsider = login(MANAGER), login(MEMBER), login(MEMBER_OTHER)
    project = new_project(manager, [user_id(member)])
    return {"manager": manager, "member": member, "outsider": outsider,
            "member_id": user_id(member), "pid": project["projectId"]}


def make_task(client, pid, **extra):
    r = client.post("/api/tasks", json={"projectId": pid, "title": "ZZTEST task", **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_create_defaults_to_todo_and_sets_location(world):
    r = world["member"].post("/api/tasks", json={
        "projectId": world["pid"], "title": "ZZTEST new", "priority": "HIGH",
        "startDate": "2026-10-01", "dueDate": "2026-10-15"})
    assert r.status_code == 201 and r.headers["location"].startswith("/api/tasks/")
    task = r.json()
    assert task["status"] == "TO_DO" and task["priority"] == "HIGH"
    assert task["startDate"] == "2026-10-01" and task["dueDate"] == "2026-10-15"


def test_due_date_before_start_date_is_400(world):
    r = world["member"].post("/api/tasks", json={
        "projectId": world["pid"], "title": "ZZTEST d", "startDate": "2026-10-10",
        "dueDate": "2026-10-01"})
    assert r.status_code == 400 and "dueDate" in r.json()["fieldErrors"]


def test_create_in_a_project_you_do_not_belong_to_is_refused(world):
    r = world["outsider"].post("/api/tasks", json={"projectId": world["pid"], "title": "ZZTEST x"})
    assert r.status_code == 404


def test_member_cannot_assign_others_manager_can_to_several(world):
    pid, member_id = world["pid"], world["member_id"]
    r = world["member"].post("/api/tasks", json={
        "projectId": pid, "title": "ZZTEST a", "assigneeIds": [member_id]})
    assert r.status_code == 403                                   # FR-008c / FR-032
    mgr_id = user_id(world["manager"])
    task = make_task(world["manager"], pid, assigneeIds=[member_id, mgr_id])
    assert {a["userId"] for a in task["assignees"]} == {member_id, mgr_id}   # FR-019


def test_assignee_must_belong_to_the_project(world):
    outsider_id = user_id(world["outsider"])
    r = world["manager"].post("/api/tasks", json={
        "projectId": world["pid"], "title": "ZZTEST a", "assigneeIds": [outsider_id]})
    assert r.status_code == 400 and "assigneeIds" in r.json()["fieldErrors"]


def test_invisible_task_is_404_everywhere_not_403(world):
    tid = make_task(world["manager"], world["pid"])["taskId"]
    out = world["outsider"]
    assert out.get(f"/api/tasks/{tid}").status_code == 404
    assert out.put(f"/api/tasks/{tid}", json={"title": "ZZTEST hax"}).status_code == 404
    assert out.delete(f"/api/tasks/{tid}").status_code == 404
    assert out.patch(f"/api/tasks/{tid}/status", json={"status": "REVIEW"}).status_code == 404
    assert out.get(f"/api/tasks/{tid}/comments").status_code == 404
    assert out.get(f"/api/tasks/{tid}/subtasks").status_code == 404
    assert out.get(f"/api/tasks/{tid}/attachments").status_code == 404


def test_put_updates_fields_and_rejects_status(world):
    tid = make_task(world["manager"], world["pid"])["taskId"]
    ok = world["member"].put(f"/api/tasks/{tid}", json={"title": "ZZTEST edited",
                                                        "priority": "LOW", "dueDate": "2026-12-01"})
    assert ok.status_code == 200
    assert ok.json()["title"] == "ZZTEST edited" and ok.json()["priority"] == "LOW"
    assert ok.json()["status"] == "TO_DO"
    bad = world["member"].put(f"/api/tasks/{tid}", json={"title": "ZZTEST edited", "status": "REVIEW"})
    assert bad.status_code == 400
    assert world["member"].get(f"/api/tasks/{tid}").json()["status"] == "TO_DO"


def test_every_status_is_reachable_in_both_directions_and_others_are_rejected(world):
    pid = world["pid"]
    tid = make_task(world["manager"], pid, assigneeIds=[world["member_id"]])["taskId"]
    member = world["member"]                                # an assignee
    path = STATUSES + STATUSES[::-1]
    for status in path:
        assert member.patch(f"/api/tasks/{tid}/status", json={"status": status}).status_code == 204
        assert member.get(f"/api/tasks/{tid}").json()["status"] == status
    for bad in ["DONE", "BLOCKED", "", "to_do"]:
        r = member.patch(f"/api/tasks/{tid}/status", json={"status": bad})
        assert r.status_code == 400, bad
    assert member.patch(f"/api/tasks/{tid}/status", json={}).status_code == 400


def test_parent_can_complete_with_incomplete_subtasks(world):
    mgr = world["manager"]
    tid = make_task(mgr, world["pid"])["taskId"]
    mgr.post(f"/api/tasks/{tid}/subtasks", json={"title": "ZZTEST open subtask"})
    assert mgr.patch(f"/api/tasks/{tid}/status", json={"status": "COMPLETED"}).status_code == 204


def test_status_change_permission_assignee_manager_admin_only(world, login):
    tid = make_task(world["manager"], world["pid"])["taskId"]          # no assignees
    body = {"status": "IN_PROGRESS"}
    assert world["member"].patch(f"/api/tasks/{tid}/status", json=body).status_code == 403
    assert world["manager"].patch(f"/api/tasks/{tid}/status", json=body).status_code == 204
    assert login(ADMIN).patch(f"/api/tasks/{tid}/status", json={"status": "REVIEW"}).status_code == 204


def test_assign_and_unassign_endpoints(world):
    tid = make_task(world["manager"], world["pid"])["taskId"]
    mid = world["member_id"]
    assert world["member"].post(f"/api/tasks/{tid}/assignees", json={"userIds": [mid]}).status_code == 403
    r = world["manager"].post(f"/api/tasks/{tid}/assignees", json={"userIds": [mid]})
    assert r.status_code == 200 and [a["userId"] for a in r.json()["assignees"]] == [mid]
    assert world["member"].delete(f"/api/tasks/{tid}/assignees/{mid}").status_code == 403
    assert world["manager"].delete(f"/api/tasks/{tid}/assignees/{mid}").status_code == 204
    assert world["manager"].delete(f"/api/tasks/{tid}/assignees/{mid}").status_code == 404


def test_assigned_to_me_and_shared_with_me_partition_project_tasks(world):
    pid, mid = world["pid"], world["member_id"]
    mine = make_task(world["manager"], pid, title="ZZTEST mine", assigneeIds=[mid])["taskId"]
    theirs = make_task(world["manager"], pid, title="ZZTEST theirs")["taskId"]
    assigned = {t["taskId"] for t in world["member"].get(
        "/api/tasks/assigned-to-me", params={"projectId": pid}).json()["content"]}
    shared = {t["taskId"] for t in world["member"].get(
        "/api/tasks/shared-with-me", params={"projectId": pid}).json()["content"]}
    assert assigned == {mine} and shared == {theirs}                  # FR-030, FR-031, FR-035
    assert not assigned & shared
    # Nothing outside the outsider's projects ever appears for them.
    leaked = world["outsider"].get("/api/tasks/shared-with-me", params={"projectId": pid}).json()
    assert leaked["content"] == [] and leaked["totalElements"] == 0


def test_search_filters_combine_with_and_and_empty_is_200(world):
    pid, mid = world["pid"], world["member_id"]
    mgr = world["manager"]
    a = make_task(mgr, pid, title="ZZTEST Alpha Report", priority="HIGH", dueDate="2026-03-10",
                  startDate="2026-03-01", assigneeIds=[mid])["taskId"]
    b = make_task(mgr, pid, title="ZZTEST beta report", priority="LOW", dueDate="2026-06-10")["taskId"]
    mgr.patch(f"/api/tasks/{b}/status", json={"status": "REVIEW"})

    def ids(**params):
        r = world["member"].get("/api/tasks", params={"projectId": pid, **params})
        assert r.status_code == 200, r.text
        return {t["taskId"] for t in r.json()["content"]}

    assert ids() == {a, b}
    assert ids(title="REPORT") == {a, b} and ids(title="alpha") == {a}       # case-insensitive substring
    assert ids(priority="HIGH") == {a} and ids(status="REVIEW") == {b}
    assert ids(userId=mid) == {a}
    assert ids(dueDateFrom="2026-05-01") == {b} and ids(dueDateTo="2026-04-01") == {a}
    assert ids(title="report", priority="LOW", status="REVIEW") == {b}       # AND
    assert ids(title="report", priority="HIGH", status="REVIEW") == set()    # empty, not an error
    assert ids(title="100%") == set()                                        # wildcard is literal
    assert world["member"].get("/api/tasks", params={"status": "DONE"}).status_code == 400


def test_overdue_filter(world):
    pid, mgr = world["pid"], world["manager"]
    late = make_task(mgr, pid, title="ZZTEST late", dueDate="2020-01-01")["taskId"]
    done = make_task(mgr, pid, title="ZZTEST late done", dueDate="2020-01-01")["taskId"]
    soon = make_task(mgr, pid, title="ZZTEST later", dueDate="2999-01-01")["taskId"]
    mgr.patch(f"/api/tasks/{done}/status", json={"status": "COMPLETED"})
    over = {t["taskId"] for t in mgr.get("/api/tasks", params={"projectId": pid, "overdue": True}).json()["content"]}
    assert over == {late}
    rest = {t["taskId"] for t in mgr.get("/api/tasks", params={"projectId": pid, "overdue": False}).json()["content"]}
    assert rest == {done, soon}


def test_search_by_project_you_do_not_belong_to_is_empty_never_a_leak(world):
    make_task(world["manager"], world["pid"])
    r = world["outsider"].get("/api/tasks", params={"projectId": world["pid"]})
    assert r.status_code == 200 and r.json()["content"] == []
    assert world["outsider"].get("/api/tasks", params={"title": "ZZTEST"}).json()["content"] == []


def test_paging_and_sorting(world):
    pid = world["pid"]
    for i in range(3):
        make_task(world["manager"], pid, title=f"ZZTEST sort {i}")
    r = world["manager"].get("/api/tasks", params={"projectId": pid, "size": 2, "page": 1,
                                                    "sort": "title,desc"}).json()
    assert r["page"] == 1 and r["size"] == 2 and r["totalElements"] == 3 and r["totalPages"] == 2
    assert [t["title"] for t in r["content"]] == ["ZZTEST sort 0"]
    assert world["manager"].get("/api/tasks", params={"sort": "password"}).status_code == 400
    assert world["manager"].get("/api/tasks", params={"size": 101}).status_code == 400


def test_delete_permissions_and_cascade(world, dbc):
    mgr, member = world["manager"], world["member"]
    by_manager = make_task(mgr, world["pid"])["taskId"]
    by_member = make_task(member, world["pid"])["taskId"]
    mgr.post(f"/api/tasks/{by_member}/subtasks", json={"title": "ZZTEST s"})
    mgr.post(f"/api/tasks/{by_member}/comments", json={"body": "ZZTEST c"})
    assert member.delete(f"/api/tasks/{by_manager}").status_code == 403    # not creator, not manager
    assert member.delete(f"/api/tasks/{by_member}").status_code == 204    # creator
    assert mgr.delete(f"/api/tasks/{by_manager}").status_code == 204
    assert mgr.get(f"/api/tasks/{by_member}").status_code == 404
    for table in ("subtasks", "comments", "attachments", "task_assignees", "notifications"):
        assert dbc.scalar(f"SELECT COUNT(*) FROM {table} WHERE task_id = :t", {"t": by_member}) == 0
