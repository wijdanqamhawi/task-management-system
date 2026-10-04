"""US2: projects and membership (FR-009..FR-015, FR-008b)."""
from tests.conftest import ADMIN, MANAGER, MANAGER2, MEMBER, MEMBER_OTHER, user_id


def test_member_cannot_create_project(login):
    r = login(MEMBER).post("/api/projects", json={"name": "ZZTEST nope"})
    assert r.status_code == 403


def test_manager_creates_project_and_becomes_member(login, new_project):
    manager = login(MANAGER)
    project = new_project(manager)
    assert project["status"] == "ACTIVE"
    assert [m["userId"] for m in project["members"]] == [user_id(manager)]


def test_end_date_before_start_date_is_rejected(login):
    r = login(MANAGER).post("/api/projects", json={
        "name": "ZZTEST dates", "startDate": "2026-05-01", "endDate": "2026-04-01"})
    assert r.status_code == 400 and "endDate" in r.json()["fieldErrors"]


def test_visibility_non_member_gets_404_member_gets_it(login, new_project):
    manager, member, outsider = login(MANAGER), login(MEMBER), login(MEMBER_OTHER)
    project = new_project(manager, [user_id(member)])
    pid = project["projectId"]
    assert member.get(f"/api/projects/{pid}").status_code == 200
    assert outsider.get(f"/api/projects/{pid}").status_code == 404
    ids = [p["projectId"] for p in member.get("/api/projects", params={"size": 100}).json()["content"]]
    assert pid in ids
    ids = [p["projectId"] for p in outsider.get("/api/projects", params={"size": 100}).json()["content"]]
    assert pid not in ids


def test_admin_sees_every_project(login, new_project):
    pid = new_project(login(MANAGER))["projectId"]
    assert login(ADMIN).get(f"/api/projects/{pid}").status_code == 200


def test_update_and_delete_require_manager_of_the_project(login, new_project):
    manager, member, other_manager = login(MANAGER), login(MEMBER), login(MANAGER2)
    pid = new_project(manager, [user_id(member)])["projectId"]
    body = {"name": "ZZTEST renamed", "status": "COMPLETED"}
    assert member.put(f"/api/projects/{pid}", json=body).status_code == 403
    # A Manager who is NOT a member of this project cannot manage it: a role alone is not enough.
    assert other_manager.put(f"/api/projects/{pid}", json=body).status_code == 404
    ok = manager.put(f"/api/projects/{pid}", json=body)
    assert ok.status_code == 200 and ok.json()["name"] == "ZZTEST renamed"
    assert member.delete(f"/api/projects/{pid}").status_code == 403
    assert manager.delete(f"/api/projects/{pid}").status_code == 204
    assert manager.get(f"/api/projects/{pid}").status_code == 404


def test_membership_management_and_duplicates(login, new_project):
    manager, member = login(MANAGER), login(MEMBER)
    pid = new_project(manager)["projectId"]
    uid = user_id(member)
    assert member.post(f"/api/projects/{pid}/members", json={"userId": uid}).status_code == 404
    assert manager.post(f"/api/projects/{pid}/members", json={"userId": uid}).status_code == 201
    assert manager.post(f"/api/projects/{pid}/members", json={"userId": uid}).status_code == 409
    assert manager.post(f"/api/projects/{pid}/members", json={"userId": 999999}).status_code == 404
    assert len(manager.get(f"/api/projects/{pid}/members").json()) == 2


def test_removing_a_member_unassigns_them_in_that_project_only(login, new_project):
    manager, member = login(MANAGER), login(MEMBER)
    uid = user_id(member)
    p1 = new_project(manager, [uid], name="ZZTEST p1")["projectId"]
    p2 = new_project(manager, [uid], name="ZZTEST p2")["projectId"]
    t1 = manager.post("/api/tasks", json={"projectId": p1, "title": "ZZTEST a",
                                          "assigneeIds": [uid]}).json()["taskId"]
    t2 = manager.post("/api/tasks", json={"projectId": p2, "title": "ZZTEST b",
                                          "assigneeIds": [uid]}).json()["taskId"]
    summary = manager.delete(f"/api/projects/{p1}/members/{uid}")
    assert summary.status_code == 200
    assert summary.json()["removedAssignments"] == 1
    assert summary.json()["unassignedTasks"][0]["taskId"] == t1
    assert manager.get(f"/api/tasks/{t1}").json()["assignees"] == []
    assert [a["userId"] for a in manager.get(f"/api/tasks/{t2}").json()["assignees"]] == [uid]
    assert manager.delete(f"/api/projects/{p1}/members/{uid}").status_code == 404


def test_progress_is_completed_over_total(login, new_project):
    manager = login(MANAGER)
    pid = new_project(manager)["projectId"]
    ids = [manager.post("/api/tasks", json={"projectId": pid, "title": f"ZZTEST {i}"}).json()["taskId"]
           for i in range(4)]
    assert manager.patch(f"/api/tasks/{ids[0]}/status", json={"status": "COMPLETED"}).status_code == 204
    progress = manager.get(f"/api/projects/{pid}/progress")
    assert progress.status_code == 200, progress.text
    assert progress.json() == {"projectId": pid, "name": "ZZTEST project", "totalTasks": 4,
                               "completedTasks": 1, "percentComplete": 25}
