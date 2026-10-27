"""RBAC Phase 2 integration tests (isolated TMS_TEST schema only; see conftest.py).

Permissions answer "may this role ever do X?"; the resource rules (project membership, manager
membership, assignee, creator, uploader) must still answer "on THIS row?". Both are tested.
"""
from app import db as appdb
from app.common import permissions as perms
from app.deps import load_permissions
from app.modules.notifications import service as notifications
from tests.test_permissions_unit import ADMIN_PERMS, MANAGER_PERMS, MEMBER_PERMS

OLD_FIELDS = {"userId", "username", "email", "fullName", "role", "isActive", "createdAt"}
EXPECTED = {"admin": ("ADMIN", ADMIN_PERMS), "mgr": ("MANAGER", MANAGER_PERMS),
            "mgr_out": ("MANAGER", MANAGER_PERMS), "mem": ("MEMBER", MEMBER_PERMS),
            "outsider": ("MEMBER", MEMBER_PERMS)}


# ------------------------------------------------------------------ loading and /me, /login

def test_effective_permissions_come_from_the_database_per_role(world):
    with appdb.connection() as db:
        for key, (role, expected) in EXPECTED.items():
            loaded = load_permissions(db, world["ids"][key])
            assert loaded == expected, key
            assert loaded <= perms.ALL_PERMISSIONS
        assert len(load_permissions(db, world["ids"]["admin"])) == 23
        assert len(load_permissions(db, world["ids"]["mgr"])) == 19
        assert len(load_permissions(db, world["ids"]["mem"])) == 10


def test_login_and_me_keep_every_existing_field_and_add_permissions(rbac_app, world):
    from fastapi.testclient import TestClient
    for key, (role, expected) in EXPECTED.items():
        client = TestClient(rbac_app)
        login = client.post("/api/auth/login",
                            json={"email": f"zztest.{key}@example.org", "password": "Passw0rd!"})
        me = client.get("/api/auth/me")
        client.close()
        for body in (login.json(), me.json()):
            assert set(body) == OLD_FIELDS | {"permissions"}
            assert body["role"] == role and body["isActive"] is True
            assert body["permissions"] == sorted(expected)
        assert login.json() == me.json()          # SessionContext can use either response


def test_me_still_requires_authentication_and_other_views_have_no_permissions(rbac_app, world):
    from fastapi.testclient import TestClient
    anon = TestClient(rbac_app)
    assert anon.get("/api/auth/me").status_code == 401
    registered = anon.post("/api/auth/register", json={
        "email": "zztest.registered@example.org", "password": "Passw0rd!", "fullName": "ZZTEST Reg"})
    anon.close()
    assert registered.status_code == 201 and "permissions" not in registered.json()
    listing = world["c"]["admin"].get("/api/users", params={"search": "zztest"}).json()
    assert all("permissions" not in u for u in listing["content"])


# ------------------------------------------------------------------ global (role-level) gates

def test_project_creation_requires_project_create(world):
    c = world["c"]
    body = {"name": "ZZTEST created", "status": "ACTIVE"}
    assert c["mem"].post("/api/projects", json=body).status_code == 403
    assert c["outsider"].post("/api/projects", json=body).status_code == 403
    assert c["mgr"].post("/api/projects", json=body).status_code == 201
    assert c["admin"].post("/api/projects", json=body).status_code == 201


def test_user_administration_requires_user_permissions(world):
    c, target = world["c"], world["ids"]["target"]
    assert c["mgr"].put(f"/api/users/{target}/role", json={"role": "MANAGER"}).status_code == 403
    assert c["mem"].put(f"/api/users/{target}/deactivate").status_code == 403
    assert c["mem"].put(f"/api/users/{target}/activate").status_code == 403
    assert c["admin"].put(f"/api/users/{target}/role", json={"role": "MANAGER"}).status_code == 200
    assert c["admin"].put(f"/api/users/{target}/role", json={"role": "SUPERUSER"}).status_code == 400
    assert c["admin"].put(f"/api/users/{target}/deactivate").status_code == 200
    assert c["admin"].put(f"/api/users/{target}/activate").status_code == 200


# ------------------------------------------------------------------ resource-level rules kept

def test_visibility_is_membership_scoped_with_admin_bypass(world):
    c, t1 = world["c"], world["tasks"]["t1"]
    names = lambda key: {p["name"] for p in c[key].get("/api/projects").json()["content"]}
    assert "ZZTEST rbac" in names("mgr") and "ZZTEST rbac" in names("mem")
    assert "ZZTEST rbac" not in names("mgr_out") and "ZZTEST rbac" not in names("outsider")
    assert "ZZTEST rbac" in names("admin")                       # PROJECT_VIEW_ALL
    assert c["admin"].get(f"/api/tasks/{t1}").status_code == 200
    assert c["outsider"].get(f"/api/tasks/{t1}").status_code == 404
    assert c["mgr_out"].get(f"/api/tasks/{t1}").status_code == 404   # a role alone is not enough


def test_project_management_needs_the_permission_and_membership(world):
    c, pid = world["c"], world["project"]
    body = {"name": "ZZTEST rbac", "status": "ACTIVE"}
    assert c["mem"].put(f"/api/projects/{pid}", json=body).status_code == 403
    assert c["mem"].post(f"/api/projects/{pid}/members",
                         json={"userId": world["ids"]["target"]}).status_code == 403
    assert c["mem"].delete(f"/api/projects/{pid}").status_code == 403
    assert c["mgr_out"].put(f"/api/projects/{pid}", json=body).status_code == 404
    assert c["mgr"].put(f"/api/projects/{pid}", json=body).status_code == 200
    assert c["admin"].put(f"/api/projects/{pid}", json=body).status_code == 200
    assert c["mgr"].post(f"/api/projects/{pid}/members",
                         json={"userId": world["ids"]["target"]}).status_code == 201
    assert c["mgr"].delete(f"/api/projects/{pid}/members/{world['ids']['target']}").status_code == 200


def test_task_edit_assign_and_unassign_are_manager_of_the_project_only(world):
    c, t1, ids = world["c"], world["tasks"]["t1"], world["ids"]
    assert c["mem"].put(f"/api/tasks/{t1}", json={"title": "ZZTEST x"}).status_code == 403
    assert c["mem2"].put(f"/api/tasks/{t1}", json={"title": "ZZTEST x"}).status_code == 403
    assert c["mgr_out"].put(f"/api/tasks/{t1}", json={"title": "ZZTEST x"}).status_code == 404
    assert c["outsider"].put(f"/api/tasks/{t1}", json={"title": "ZZTEST x"}).status_code == 404
    assert c["mgr"].put(f"/api/tasks/{t1}", json={"title": "ZZTEST edited"}).status_code == 200
    assert c["admin"].put(f"/api/tasks/{t1}", json={"title": "ZZTEST edited 2"}).status_code == 200

    assert c["mem"].post(f"/api/tasks/{t1}/assignees", json={"userIds": [ids["mem2"]]}).status_code == 403
    assert c["mgr_out"].post(f"/api/tasks/{t1}/assignees", json={"userIds": [ids["mem2"]]}).status_code == 404
    assert c["mgr"].post(f"/api/tasks/{t1}/assignees", json={"userIds": [ids["mem2"]]}).status_code == 200
    assert c["mem"].delete(f"/api/tasks/{t1}/assignees/{ids['mem2']}").status_code == 403
    assert c["mgr"].delete(f"/api/tasks/{t1}/assignees/{ids['mem2']}").status_code == 204


def test_creating_a_task_with_assignees_needs_manager_rights(world):
    c, ids, pid = world["c"], world["ids"], world["project"]
    body = {"projectId": pid, "title": "ZZTEST new"}
    assert c["mem"].post("/api/tasks", json={**body, "assigneeIds": [ids["mem2"]]}).status_code == 403
    assert c["mem"].post("/api/tasks", json=body).status_code == 201          # unchanged for members
    assert c["mgr"].post("/api/tasks", json={**body, "assigneeIds": [ids["mem2"]]}).status_code == 201
    assert c["outsider"].post("/api/tasks", json=body).status_code == 404


def test_status_change_is_admin_assignee_or_manager_of_the_task_project(world):
    c, t1, t3 = world["c"], world["tasks"]["t1"], world["tasks"]["t3"]
    body = {"status": "IN_PROGRESS"}
    # t3 has no assignee: a plain member must NOT gain access merely because MEMBER holds
    # TASK_STATUS_CHANGE.
    assert c["mem"].patch(f"/api/tasks/{t3}/status", json=body).status_code == 403
    assert c["mem2"].patch(f"/api/tasks/{t3}/status", json=body).status_code == 403
    assert c["outsider"].patch(f"/api/tasks/{t3}/status", json=body).status_code == 404
    assert c["mgr_out"].patch(f"/api/tasks/{t3}/status", json=body).status_code == 404
    assert c["mgr"].patch(f"/api/tasks/{t3}/status", json=body).status_code == 204
    assert c["admin"].patch(f"/api/tasks/{t3}/status", json={"status": "REVIEW"}).status_code == 204
    # t1 is assigned to mem only.
    assert c["mem2"].patch(f"/api/tasks/{t1}/status", json=body).status_code == 403
    assert c["mem"].patch(f"/api/tasks/{t1}/status", json=body).status_code == 204


def test_task_delete_is_manager_of_the_project_or_the_creator(world):
    c, tasks = world["c"], world["tasks"]
    assert c["mem"].delete(f"/api/tasks/{tasks['t2']}").status_code == 403    # not the creator
    assert c["mem2"].delete(f"/api/tasks/{tasks['t1']}").status_code == 403   # creator of t2 only
    assert c["mgr_out"].delete(f"/api/tasks/{tasks['t3']}").status_code == 404
    assert c["outsider"].delete(f"/api/tasks/{tasks['t3']}").status_code == 404
    assert c["mem2"].delete(f"/api/tasks/{tasks['t2']}").status_code == 204   # creator, a MEMBER
    assert c["mgr"].delete(f"/api/tasks/{tasks['t1']}").status_code == 204    # manager
    assert c["admin"].delete(f"/api/tasks/{tasks['t3']}").status_code == 204


def test_attachment_delete_is_uploader_or_manager_of_the_project(world):
    c, a = world["c"], world["attachments"]
    assert c["mem"].delete(f"/api/attachments/{a['a_mem2']}").status_code == 403   # not uploader
    assert c["outsider"].delete(f"/api/attachments/{a['a_mem2']}").status_code == 404
    assert c["mgr_out"].delete(f"/api/attachments/{a['a_mem2']}").status_code == 404
    assert c["mem2"].delete(f"/api/attachments/{a['a_mem2']}").status_code == 204  # uploader, MEMBER
    assert c["mgr"].delete(f"/api/attachments/{a['a_mem']}").status_code == 204    # manager
    assert c["admin"].delete(f"/api/attachments/{a['a_mgr']}").status_code == 204  # admin


def test_notification_recipients_follow_view_all_or_membership(world):
    ids = world["ids"]
    task = {"task_id": world["tasks"]["t1"], "project_id": world["project"], "title": "ZZTEST t1"}
    with appdb.connection() as db:
        sent = notifications.notify(
            db, task=task, recipient_ids=[ids["admin"], ids["mem"], ids["outsider"], ids["mgr_out"]],
            trigger_type=notifications.UPDATE, message="ZZTEST", actor_id=None)
        got = {r["recipient_id"] for r in db.query(
            "SELECT recipient_id FROM notifications WHERE message = 'ZZTEST'")}
    assert sent == 2 and got == {ids["admin"], ids["mem"]}      # rolled back by the context


# ------------------------------------------------------------------ the grants really drive access

def test_changing_grants_in_the_database_changes_access_immediately(world):
    c = world["c"]
    body = {"name": "ZZTEST grant", "status": "ACTIVE"}

    def grant(role, code):
        with appdb.connection() as db:
            db.execute(
                "INSERT INTO role_permissions (role_id, permission_id) "
                "SELECT r.role_id, p.permission_id FROM roles r, permissions p "
                "WHERE r.role_name = :r AND p.permission_code = :c "
                "AND NOT EXISTS (SELECT 1 FROM role_permissions x "
                "WHERE x.role_id = r.role_id AND x.permission_id = p.permission_id)",
                {"r": role, "c": code})
            db.commit()

    def revoke(role, code):
        with appdb.connection() as db:
            db.execute(
                "DELETE FROM role_permissions WHERE role_id = (SELECT role_id FROM roles "
                "WHERE role_name = :r) AND permission_id = (SELECT permission_id FROM "
                "permissions WHERE permission_code = :c)", {"r": role, "c": code})
            db.commit()

    try:
        revoke("MANAGER", perms.PROJECT_CREATE)
        assert c["mgr"].post("/api/projects", json=body).status_code == 403   # same session, no restart
        assert perms.PROJECT_CREATE not in c["mgr"].get("/api/auth/me").json()["permissions"]
        grant("MEMBER", perms.PROJECT_CREATE)
        assert c["mem"].post("/api/projects", json=body).status_code == 201
    finally:
        revoke("MEMBER", perms.PROJECT_CREATE)               # restore TMS_TEST to the seeded state
        grant("MANAGER", perms.PROJECT_CREATE)
    assert c["mgr"].post("/api/projects", json=body).status_code == 201
    assert c["mem"].post("/api/projects", json=body).status_code == 403
    with appdb.connection() as db:
        assert db.scalar("SELECT COUNT(*) FROM role_permissions") == 52
