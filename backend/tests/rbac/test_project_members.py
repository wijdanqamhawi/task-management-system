"""Project membership rules (isolated TMS_TEST schema only; see conftest.py).

world: admin = ADMIN, NOT a member | mgr = MANAGER, member and project owner (created_by)
mem = MEMBER (assignee of t1) | mem2 = MEMBER | target, outsider = MEMBER, not members
mgr_out = MANAGER of another project.

Rules: ADMIN and a project MANAGER add/remove other members. Only an ADMIN may remove themselves,
and only after naming a replacement (active ADMIN or MANAGER already in the project); ownership
(`projects.created_by`) then moves to the replacement in the same transaction. MANAGER and MEMBER
can never remove themselves.
"""
import pytest

from app import db as appdb
from app.security import hash_password

PW = hash_password("Passw0rd!")


def _url(world, user_id, replacement=None):
    suffix = "" if replacement is None else f"?replacementUserId={replacement}"
    return f"/api/projects/{world['project']}/members/{user_id}{suffix}"


def _make_user(key, role, active="Y"):
    with appdb.connection() as db:
        uid = db.insert(
            "INSERT INTO users (username, email, password_hash, full_name, role_id, is_active) "
            "VALUES (:u, :e, :h, :n, (SELECT role_id FROM roles WHERE role_name = :r), :a)",
            {"u": f"zztest_{key}", "e": f"zztest.{key}@example.org", "h": PW,
             "n": f"ZZTEST {key}", "r": role, "a": active}, "user_id")
        db.commit()
    return uid


def _join(world, user_id):
    with appdb.connection() as db:
        db.execute("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)",
                   {"p": world["project"], "u": user_id})
        db.commit()


def _state(world, user_id=None):
    with appdb.connection() as db:
        owner = db.scalar("SELECT created_by FROM projects WHERE project_id = :p", {"p": world["project"]})
        members = {r["user_id"] for r in db.query(
            "SELECT user_id FROM project_members WHERE project_id = :p", {"p": world["project"]})}
    return owner, members


def _set_owner(world, user_id):
    with appdb.connection() as db:
        db.execute("UPDATE projects SET created_by = :u WHERE project_id = :p",
                   {"u": user_id, "p": world["project"]})
        db.commit()


def _assign(world, user_id, task="t1"):
    with appdb.connection() as db:
        db.execute("INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (:t, :u, :a)",
                   {"t": world["tasks"][task], "u": user_id, "a": world["ids"]["mgr"]})
        db.commit()


def _assignments(world, user_id):
    with appdb.connection() as db:
        return db.scalar("SELECT COUNT(*) FROM task_assignees WHERE user_id = :u", {"u": user_id})


@pytest.fixture()
def admin_member(world):
    """The ADMIN becomes a member and the project owner, with one task assignment."""
    admin = world["ids"]["admin"]
    _join(world, admin)
    _set_owner(world, admin)
    _assign(world, admin, "t3")
    return admin


# ------------------------------------------------------------------ ADMIN removes another member

def test_admin_removes_another_member_without_touching_ownership(world):
    ids = world["ids"]
    resp = world["c"]["admin"].delete(_url(world, ids["mem"]))
    assert resp.status_code == 200
    assert resp.json()["removedAssignments"] == 1 and resp.json()["responsibilityTransferredTo"] is None
    owner, members = _state(world)
    assert ids["mem"] not in members and owner == ids["mgr"]
    assert _assignments(world, ids["mem"]) == 0


# ------------------------------------------------------------------ ADMIN removes themselves

@pytest.mark.parametrize("kind", ["ADMIN", "MANAGER"])
def test_admin_leaves_with_an_admin_or_manager_replacement(world, admin_member, kind):
    if kind == "ADMIN":
        replacement = _make_user("admin2", "ADMIN")
        _join(world, replacement)
    else:
        replacement = world["ids"]["mgr"]
    resp = world["c"]["admin"].delete(_url(world, admin_member, replacement))
    assert resp.status_code == 200, resp.text
    assert resp.json()["responsibilityTransferredTo"] == replacement
    owner, members = _state(world)
    assert owner == replacement and admin_member not in members     # responsibility moved, admin gone
    assert replacement in members
    assert _assignments(world, admin_member) == 0                   # their assignments went with them


def test_admin_who_is_not_the_owner_leaves_without_taking_ownership_from_anyone(world):
    ids = world["ids"]
    _join(world, ids["admin"])
    resp = world["c"]["admin"].delete(_url(world, ids["admin"], ids["mgr"]))
    assert resp.status_code == 200 and resp.json()["responsibilityTransferredTo"] is None
    assert _state(world)[0] == ids["mgr"]                           # the existing owner is kept


def test_admin_self_removal_without_a_replacement_is_refused(world, admin_member):
    resp = world["c"]["admin"].delete(_url(world, admin_member))
    assert resp.status_code == 400
    assert "replacementUserId" in (resp.json().get("fieldErrors") or {})
    owner, members = _state(world)
    assert owner == admin_member and admin_member in members        # nothing changed


def test_admin_self_removal_is_blocked_when_no_eligible_replacement_exists(world, admin_member):
    """mgr and everyone else is MEMBER-or-out: removing mgr from the project leaves none."""
    with appdb.connection() as db:
        db.execute("DELETE FROM project_members WHERE project_id = :p AND user_id = :u",
                   {"p": world["project"], "u": world["ids"]["mgr"]})
        db.commit()
    for candidate in (world["ids"]["mem"], world["ids"]["mgr"]):
        assert world["c"]["admin"].delete(_url(world, admin_member, candidate)).status_code == 400
    assert admin_member in _state(world)[1]


def _invalid_replacements(world):
    ids = world["ids"]
    inactive_admin = _make_user("admin_off", "ADMIN", active="N")
    _join(world, inactive_admin)
    return {
        "oneself": ids["admin"],
        "not a member": ids["mgr_out"],                  # a MANAGER, but not in this project
        "member role": ids["mem"],                       # in the project, but a MEMBER
        "unknown user": 999999999,
        "inactive admin": inactive_admin,
    }


def test_admin_self_removal_with_an_invalid_replacement_is_refused(world, admin_member):
    for label, replacement in _invalid_replacements(world).items():
        resp = world["c"]["admin"].delete(_url(world, admin_member, replacement))
        assert resp.status_code == 400, label
        assert "replacementUserId" in (resp.json().get("fieldErrors") or {}), label
    owner, members = _state(world)
    assert owner == admin_member and admin_member in members
    assert _assignments(world, admin_member) == 1                   # not unassigned either


@pytest.mark.parametrize("bad", ["0", "-3", "abc", ""])
def test_malformed_replacement_is_a_validation_error(world, admin_member, bad):
    resp = world["c"]["admin"].delete(f"/api/projects/{world['project']}/members/{admin_member}"
                                      f"?replacementUserId={bad}")
    assert resp.status_code == 400 and admin_member in _state(world)[1]


def test_replacement_is_rejected_when_removing_somebody_else(world):
    ids = world["ids"]
    resp = world["c"]["admin"].delete(_url(world, ids["mem"], ids["mgr"]))
    assert resp.status_code == 400 and ids["mem"] in _state(world)[1]


# ------------------------------------------------------------------ MANAGER

def test_manager_removes_another_member(world):
    ids = world["ids"]
    assert world["c"]["mgr"].delete(_url(world, ids["mem"])).status_code == 200
    assert ids["mem"] not in _state(world)[1]


def test_manager_can_never_remove_themselves(world):
    ids = world["ids"]
    other = _make_user("admin3", "ADMIN")
    _join(world, other)
    for replacement in (None, other, ids["mem"]):                    # even naming a valid replacement
        assert world["c"]["mgr"].delete(_url(world, ids["mgr"], replacement)).status_code == 403
    owner, members = _state(world)
    assert owner == ids["mgr"] and ids["mgr"] in members


def test_manager_of_another_project_cannot_remove_here(world):
    assert world["c"]["mgr_out"].delete(_url(world, world["ids"]["mem"])).status_code == 404
    assert world["ids"]["mem"] in _state(world)[1]


# ------------------------------------------------------------------ MEMBER

def test_member_cannot_remove_anyone_including_themselves(world):
    ids = world["ids"]
    for target in (ids["mem2"], ids["mgr"], ids["mem"]):
        assert world["c"]["mem"].delete(_url(world, target)).status_code == 403
    assert world["c"]["mem"].delete(_url(world, ids["mem"], ids["mgr"])).status_code == 403
    assert {ids["mem"], ids["mem2"], ids["mgr"]} <= _state(world)[1]
    assert world["c"]["outsider"].delete(_url(world, ids["mem"])).status_code == 404   # not even visible


def test_member_cannot_add_members(world):
    assert world["c"]["mem"].post(f"/api/projects/{world['project']}/members",
                                  json={"userId": world["ids"]["target"]}).status_code == 403


# ------------------------------------------------------------------ atomicity

def test_failure_part_way_rolls_back_the_transfer_and_the_removal(world, admin_member, monkeypatch):
    """The ownership UPDATE and the assignment DELETE have already run when the membership DELETE
    fails: none of it may remain."""
    replacement = world["ids"]["mgr"]
    original = appdb.Db.execute

    def failing(self, sql, params=None):
        if sql.lstrip().upper().startswith("DELETE FROM PROJECT_MEMBERS"):
            raise RuntimeError("simulated failure after the transfer")
        return original(self, sql, params)

    with monkeypatch.context() as m:
        m.setattr(appdb.Db, "execute", failing)
        with pytest.raises(RuntimeError, match="simulated failure"):
            world["c"]["admin"].delete(_url(world, admin_member, replacement))

    owner, members = _state(world)
    assert owner == admin_member                                    # ownership NOT transferred
    assert admin_member in members and replacement in members       # membership intact
    assert _assignments(world, admin_member) == 1                   # assignment NOT removed
