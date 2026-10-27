"""Adding a project member by numeric User ID (isolated TMS_TEST schema only; see conftest.py).

The API is the authority: the Members form's own checks are convenience only.
"""
import pytest


def _add(client, pid, user_id):
    return client.post(f"/api/projects/{pid}/members", json={"userId": user_id})


def test_manager_adds_an_active_user_by_id_and_the_list_shows_them(world):
    c, pid, target = world["c"], world["project"], world["ids"]["target"]
    resp = _add(c["mgr"], pid, target)
    assert resp.status_code == 201
    assert resp.json()["userId"] == target
    assert target in {m["userId"] for m in c["mgr"].get(f"/api/projects/{pid}/members").json()}


def test_admin_who_is_not_a_member_may_add_by_id(world):
    c, pid, target = world["c"], world["project"], world["ids"]["target"]
    assert _add(c["admin"], pid, target).status_code == 201


@pytest.mark.parametrize("bad", [0, -1, "abc", "", None, 1.5])
def test_user_id_must_be_a_positive_integer(world, bad):
    assert _add(world["c"]["mgr"], world["project"], bad).status_code == 400


def test_unknown_user_id_is_not_found(world):
    assert _add(world["c"]["mgr"], world["project"], 999999999).status_code == 404


def test_deactivated_user_cannot_be_added(world):
    c, pid, target = world["c"], world["project"], world["ids"]["target"]
    assert c["admin"].put(f"/api/users/{target}/deactivate").status_code == 200
    assert _add(c["mgr"], pid, target).status_code == 400
    assert target not in {m["userId"] for m in c["mgr"].get(f"/api/projects/{pid}/members").json()}


def test_existing_member_cannot_be_added_twice(world):
    c, pid, target = world["c"], world["project"], world["ids"]["target"]
    assert _add(c["mgr"], pid, target).status_code == 201
    assert _add(c["mgr"], pid, target).status_code == 409
    assert _add(c["mgr"], pid, world["ids"]["mem"]).status_code == 409   # seeded member


def test_only_a_manager_of_this_project_may_add(world):
    c, pid, target = world["c"], world["project"], world["ids"]["target"]
    assert _add(world["c"]["mem"], pid, target).status_code == 403        # member: no permission
    assert _add(c["mgr_out"], pid, target).status_code == 404             # manager of another project
    assert _add(c["outsider"], pid, target).status_code == 404
    assert target not in {m["userId"] for m in c["mgr"].get(f"/api/projects/{pid}/members").json()}


def test_anonymous_request_is_rejected(rbac_app, world):
    from fastapi.testclient import TestClient
    anon = TestClient(rbac_app)
    try:
        assert _add(anon, world["project"], world["ids"]["target"]).status_code == 401
    finally:
        anon.close()
