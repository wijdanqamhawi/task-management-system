"""Progress items (isolated TMS_TEST schema only; see conftest.py).

world: mgr = MANAGER of the project | mgr_out = MANAGER elsewhere | admin = ADMIN, not a member
mem = MEMBER, assignee of t1 | mem2 = MEMBER of the project, NOT assigned to t1
outsider = MEMBER outside the project. Creating, editing and deleting need PROGRESS_MANAGE plus
manager scope; toggling needs PROGRESS_TOGGLE plus manager scope or assignment to the task.
"""
import pytest
from fastapi.testclient import TestClient

from app import db as appdb

AT = "2026-03-04T09:30"
END = "2026-03-06T17:00"
BODY = {"title": "ZZTEST step", "startAt": AT, "endAt": END, "sortOrder": 1}
FMT = "%Y-%m-%dT%H:%M"


def _item(world, key="mgr"):
    resp = world["c"][key].post(f"/api/tasks/{world['tasks']['t1']}/subtasks", json=BODY)
    assert resp.status_code == 201, resp.text
    return resp.json()["subtaskId"]


def _row(sid):
    with appdb.connection() as db:
        return db.one("SELECT title, is_completed, progress_at, start_at, end_at, sort_order FROM subtasks "
                      "WHERE subtask_id = :i", {"i": sid})


# ------------------------------------------------------------------ create

@pytest.mark.parametrize("key", ["admin", "mgr"])
def test_admin_and_project_manager_create_with_start_and_end(world, key):
    resp = world["c"][key].post(f"/api/tasks/{world['tasks']['t1']}/subtasks", json=BODY)
    assert resp.status_code == 201
    item = resp.json()
    assert item["startAt"] == AT + ":00" and item["endAt"] == END + ":00"
    assert item["progressAt"] == item["startAt"]                      # read-only alias
    assert item["isCompleted"] is False
    row = _row(item["subtaskId"])                                     # persisted
    assert row["start_at"].strftime(FMT) == AT and row["end_at"].strftime(FMT) == END
    assert row["progress_at"] is None                                 # legacy column no longer written


def test_create_refused_for_member_other_manager_and_outsider(rbac_app, world):
    url = f"/api/tasks/{world['tasks']['t1']}/subtasks"
    c = world["c"]
    assert c["mem"].post(url, json=BODY).status_code == 403          # even the assignee
    assert c["mem2"].post(url, json=BODY).status_code == 403
    assert c["mgr_out"].post(url, json=BODY).status_code == 404      # manager of another project
    assert c["outsider"].post(url, json=BODY).status_code == 404
    anon = TestClient(rbac_app)
    try:
        assert anon.post(url, json=BODY).status_code == 401
    finally:
        anon.close()
    assert c["mgr"].get(url).json() == []                             # nothing was written


def test_create_accepts_a_timezone_suffix_as_entered(world):
    body = {**BODY, "startAt": AT + "+00:00", "endAt": END + "Z"}
    resp = world["c"]["mgr"].post(f"/api/tasks/{world['tasks']['t1']}/subtasks", json=body)
    assert resp.status_code == 201 and resp.json()["startAt"] == AT + ":00"


@pytest.mark.parametrize("bad", [
    {"title": "ZZTEST x"},                                            # start and end are required
    {"title": "ZZTEST x", "startAt": AT},                             # end missing
    {"title": "ZZTEST x", "endAt": END},                              # start missing
    {"title": "ZZTEST x", "startAt": None, "endAt": END},
    {"title": "ZZTEST x", "startAt": AT, "endAt": None},
    {"title": "ZZTEST x", "startAt": "not a date", "endAt": END},
    {"title": "ZZTEST x", "startAt": AT, "endAt": AT},                # end must be LATER than start
    {"title": "ZZTEST x", "startAt": END, "endAt": AT},
    {"title": "ZZTEST x", "progressAt": AT, "startAt": AT, "endAt": END},   # alias is read-only
    {"title": "  ", "startAt": AT, "endAt": END},
    {"title": "ZZTEST x", "startAt": AT, "endAt": END, "isCompleted": True},  # unknown field
])
def test_create_validation(world, bad):
    assert world["c"]["mgr"].post(f"/api/tasks/{world['tasks']['t1']}/subtasks",
                                  json=bad).status_code == 400


# ------------------------------------------------------------------ view

def test_everyone_who_can_see_the_task_can_view_progress(world):
    sid = _item(world)
    url = f"/api/tasks/{world['tasks']['t1']}/subtasks"
    for key in ("admin", "mgr", "mem", "mem2"):
        items = world["c"][key].get(url).json()
        assert [i["subtaskId"] for i in items] == [sid]
        assert items[0]["startAt"] == AT + ":00" and items[0]["endAt"] == END + ":00"
        assert items[0]["progressAt"] == AT + ":00"
    assert world["c"]["mgr_out"].get(url).status_code == 404
    assert world["c"]["outsider"].get(url).status_code == 404


# ------------------------------------------------------------------ edit

def test_manager_and_admin_edit_details_but_not_completion_here(world):
    sid = _item(world)
    c = world["c"]
    ok = c["mgr"].put(f"/api/subtasks/{sid}", json={"title": "ZZTEST edited", "startAt": "2026-05-06T18:45",
                                                    "endAt": "2026-05-07T08:00"})
    assert ok.status_code == 200
    assert ok.json()["startAt"] == "2026-05-06T18:45:00" and ok.json()["endAt"] == "2026-05-07T08:00:00"
    assert ok.json()["progressAt"] == "2026-05-06T18:45:00"
    only_end = c["admin"].put(f"/api/subtasks/{sid}", json={"endAt": "2026-05-09T12:00"})   # either date alone
    assert only_end.status_code == 200 and only_end.json()["startAt"] == "2026-05-06T18:45:00"
    assert c["admin"].put(f"/api/subtasks/{sid}", json={"sortOrder": 3}).status_code == 200
    assert c["mgr"].put(f"/api/subtasks/{sid}", json={"isCompleted": True}).status_code == 400
    assert _row(sid)["is_completed"] is False and _row(sid)["title"] == "ZZTEST edited"


def test_edit_refused_for_member_other_manager_and_outsider(world):
    sid = _item(world)
    c = world["c"]
    edit = {"title": "ZZTEST hacked", "startAt": "2030-01-01T00:00", "endAt": "2030-01-02T00:00"}
    assert c["mem"].put(f"/api/subtasks/{sid}", json=edit).status_code == 403
    assert c["mem2"].put(f"/api/subtasks/{sid}", json=edit).status_code == 403
    assert c["mgr_out"].put(f"/api/subtasks/{sid}", json=edit).status_code == 404
    assert c["outsider"].put(f"/api/subtasks/{sid}", json=edit).status_code == 404
    row = _row(sid)
    assert row["title"] == "ZZTEST step"
    assert row["start_at"].strftime(FMT) == AT and row["end_at"].strftime(FMT) == END


def test_edit_validates_end_after_start_against_the_stored_value(world):
    sid, c = _item(world), world["c"]
    url = f"/api/subtasks/{sid}"
    assert c["mgr"].put(url, json={"endAt": AT}).status_code == 400                 # == stored start
    assert c["mgr"].put(url, json={"endAt": "2026-03-01T00:00"}).status_code == 400  # before stored start
    assert c["mgr"].put(url, json={"startAt": "2026-03-07T00:00"}).status_code == 400  # after stored end
    assert c["mgr"].put(url, json={"startAt": END, "endAt": AT}).status_code == 400
    assert c["mgr"].put(url, json={"progressAt": AT}).status_code == 400            # alias is read-only
    row = _row(sid)
    assert row["start_at"].strftime(FMT) == AT and row["end_at"].strftime(FMT) == END   # unchanged


def test_legacy_item_without_end_is_listed_kept_and_completable(world):
    """A row that predates migration 003: start copied from progress_at, no end, already completed."""
    t1 = world["tasks"]["t1"]
    with appdb.connection() as db:
        sid = db.insert("INSERT INTO subtasks (task_id, title, is_completed, progress_at, start_at) "
                        "VALUES (:t, 'ZZTEST legacy', 'Y', TIMESTAMP '2026-01-02 08:00:00', "
                        "TIMESTAMP '2026-01-02 08:00:00')", {"t": t1}, "subtask_id")
        db.commit()
    c = world["c"]
    item = c["mem"].get(f"/api/tasks/{t1}/subtasks").json()[0]
    assert item["startAt"] == "2026-01-02T08:00:00" and item["endAt"] is None and item["isCompleted"] is True
    assert c["mgr"].put(f"/api/subtasks/{sid}", json={"title": "ZZTEST legacy renamed"}).status_code == 200
    assert _row(sid)["is_completed"] is True and _row(sid)["end_at"] is None       # status preserved
    fixed = c["mgr"].put(f"/api/subtasks/{sid}", json={"endAt": "2026-01-03T08:00"})
    assert fixed.status_code == 200 and fixed.json()["endAt"] == "2026-01-03T08:00:00"
    assert c["mgr"].put(f"/api/subtasks/{sid}", json={"endAt": "2026-01-02T07:00"}).status_code == 400


def test_database_rejects_end_not_after_start(world):
    import oracledb
    t1 = world["tasks"]["t1"]
    with appdb.connection() as db:
        with pytest.raises(oracledb.DatabaseError, match="ORA-02290"):
            db.execute("INSERT INTO subtasks (task_id, title, start_at, end_at) VALUES "
                       "(:t, 'ZZTEST bad', TIMESTAMP '2026-01-02 08:00:00', TIMESTAMP '2026-01-02 08:00:00')",
                       {"t": t1})


# ------------------------------------------------------------------ delete

def test_delete_allowed_for_admin_and_project_manager_only(world):
    c = world["c"]
    sid = _item(world)
    assert c["mem"].delete(f"/api/subtasks/{sid}").status_code == 403
    assert c["mem2"].delete(f"/api/subtasks/{sid}").status_code == 403
    assert c["mgr_out"].delete(f"/api/subtasks/{sid}").status_code == 404
    assert c["outsider"].delete(f"/api/subtasks/{sid}").status_code == 404
    assert _row(sid) is not None
    assert c["mgr"].delete(f"/api/subtasks/{sid}").status_code == 204
    other = _item(world)
    assert c["admin"].delete(f"/api/subtasks/{other}").status_code == 204
    assert _row(other) is None


# ------------------------------------------------------------------ completion (toggle)

def test_assignee_manager_and_admin_may_toggle(world):
    c, sid = world["c"], _item(world)
    for key, value in (("mem", True), ("mgr", False), ("admin", True), ("mem", False)):
        resp = c[key].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": value})
        assert resp.status_code == 200, key
        assert resp.json()["isCompleted"] is value and _row(sid)["is_completed"] is value


def test_member_not_assigned_to_the_task_may_not_toggle(world):
    c, sid = world["c"], _item(world)
    assert c["mem2"].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": True}).status_code == 403
    assert c["mgr_out"].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": True}).status_code == 404
    assert c["outsider"].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": True}).status_code == 404
    assert _row(sid)["is_completed"] is False


@pytest.mark.parametrize("extra", [
    {"title": "ZZTEST renamed"}, {"startAt": "2030-01-01T00:00"}, {"endAt": "2030-01-02T00:00"},
    {"progressAt": "2030-01-01T00:00"}, {"sortOrder": 9},
    {"title": "ZZTEST renamed", "startAt": "2030-01-01T00:00", "endAt": "2030-01-02T00:00"},
])
def test_completion_endpoint_rejects_any_other_field(world, extra):
    c, sid = world["c"], _item(world)
    for key in ("mem", "mgr", "admin"):
        resp = c[key].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": True, **extra})
        assert resp.status_code == 400, key
    row = _row(sid)
    assert row["is_completed"] is False and row["title"] == "ZZTEST step"
    assert row["start_at"].strftime(FMT) == AT and row["end_at"].strftime(FMT) == END
    assert row["sort_order"] == 1


@pytest.mark.parametrize("body", [{}, {"isCompleted": "yes"}, {"isCompleted": None}, {"isCompleted": 1}])
def test_completion_requires_a_real_boolean(world, body):
    sid = _item(world)
    assert world["c"]["mem"].put(f"/api/subtasks/{sid}/completion", json=body).status_code == 400


def test_toggle_needs_the_permission_not_just_assignment(world):
    """Revoke PROGRESS_TOGGLE from MEMBER: the assignee is refused (same session). Restored afterwards."""
    c, sid = world["c"], _item(world)
    with appdb.connection() as db:
        db.execute("DELETE FROM role_permissions WHERE role_id = (SELECT role_id FROM roles WHERE role_name = 'MEMBER') "
                   "AND permission_id = (SELECT permission_id FROM permissions WHERE permission_code = 'PROGRESS_TOGGLE')")
        db.commit()
    try:
        assert c["mem"].put(f"/api/subtasks/{sid}/completion", json={"isCompleted": True}).status_code == 403
        assert _row(sid)["is_completed"] is False
    finally:
        with appdb.connection() as db:
            db.execute("INSERT INTO role_permissions (role_id, permission_id) "
                       "SELECT r.role_id, p.permission_id FROM roles r, permissions p "
                       "WHERE r.role_name = 'MEMBER' AND p.permission_code = 'PROGRESS_TOGGLE'")
            db.commit()


# ------------------------------------------------------------------ task status unchanged

def test_task_status_permissions_are_unchanged(world):
    c, t1 = world["c"], world["tasks"]["t1"]
    assert c["mem"].patch(f"/api/tasks/{t1}/status", json={"status": "IN_PROGRESS"}).status_code == 204
    assert c["mem2"].patch(f"/api/tasks/{t1}/status", json={"status": "REVIEW"}).status_code == 403
    assert c["mgr"].patch(f"/api/tasks/{t1}/status", json={"status": "REVIEW"}).status_code == 204
