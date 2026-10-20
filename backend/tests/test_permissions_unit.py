"""RBAC unit tests: no database, no network. They cover the permission helper, the fail-closed
`require_permission` dependency, the resource-scope rule in `is_project_manager`, and that the
permission constants match the seed file the database is loaded from.
"""
import re
from pathlib import Path

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import deps
from app.common import permissions as perms
from app.common.access import (is_project_manager, is_project_member, project_visibility_clause,
                               task_visibility_clause)
from app.errors import install_handlers

SEED = Path(__file__).resolve().parents[2] / "database" / "seed" / "rbac_data.sql"

ADMIN_PERMS = frozenset(perms.ALL_PERMISSIONS)
MEMBER_PERMS = frozenset({
    perms.PROJECT_VIEW, perms.TASK_VIEW, perms.TASK_CREATE, perms.TASK_STATUS_CHANGE,
    perms.TASK_DELETE_OWN, perms.COMMENT_CREATE, perms.SUBTASK_MANAGE, perms.ATTACHMENT_UPLOAD,
    perms.ATTACHMENT_DELETE_OWN})
MANAGER_PERMS = MEMBER_PERMS | {
    perms.PROJECT_CREATE, perms.PROJECT_UPDATE, perms.PROJECT_DELETE,
    perms.PROJECT_MEMBER_MANAGE, perms.TASK_EDIT, perms.TASK_ASSIGN, perms.TASK_DELETE_ANY,
    perms.ATTACHMENT_DELETE_ANY}


def user(permissions, user_id=1, role="MEMBER"):
    return {"user_id": user_id, "role": role, "permissions": frozenset(permissions)}


class FakeDb:
    """Stands in for Db: answers the single membership COUNT query."""

    def __init__(self, member: bool):
        self.member, self.calls = member, 0

    def scalar(self, sql, params=None):
        self.calls += 1
        assert "project_members" in sql
        return 1 if self.member else 0


# ------------------------------------------------------------------ catalogue vs seed file

def _seed_text():
    return SEED.read_text(encoding="utf-8")


def test_constants_match_the_seeded_catalogue():
    block = _seed_text().split("-- ----")[1]          # the permissions MERGE
    codes = set(re.findall(r"SELECT '([A-Z_]+)'(?: AS permission_code)?,", block))
    assert codes == set(perms.ALL_PERMISSIONS) and len(codes) == 21


def test_expected_role_sets_match_the_seeded_grants():
    grants = re.findall(r"SELECT '(ADMIN|MANAGER|MEMBER)'(?: AS role_name)?, '([A-Z_]+)'",
                        _seed_text())
    by_role = {}
    for role, code in grants:
        by_role.setdefault(role, set()).add(code)
    assert by_role == {"ADMIN": ADMIN_PERMS, "MANAGER": MANAGER_PERMS, "MEMBER": MEMBER_PERMS}
    assert [len(by_role[r]) for r in ("ADMIN", "MANAGER", "MEMBER")] == [21, 17, 9]


# ------------------------------------------------------------------ has_permission

def test_has_permission_grants_only_what_the_user_holds():
    u = user(MEMBER_PERMS)
    assert perms.has_permission(u, perms.TASK_VIEW)
    assert not perms.has_permission(u, perms.PROJECT_CREATE)


def test_has_permission_fails_closed_for_unknown_code_even_if_present():
    u = user(MEMBER_PERMS | {"NOT_A_REAL_PERMISSION"})
    assert not perms.has_permission(u, "NOT_A_REAL_PERMISSION")
    assert not perms.has_permission(user(ADMIN_PERMS), "NOT_A_REAL_PERMISSION")
    assert not perms.has_permission(user(ADMIN_PERMS), "")


@pytest.mark.parametrize("bad_user", [{}, {"permissions": None}, {"permissions": ()},
                                      {"role": "ADMIN", "user_id": 1}])
def test_has_permission_fails_closed_without_a_permission_set(bad_user):
    # The role name alone never grants anything: ADMIN needs the ADMIN grants.
    assert not perms.has_permission(bad_user, perms.PROJECT_VIEW_ALL)


# ------------------------------------------------------------------ require_permission

def _app_with(code, current):
    app = FastAPI()
    install_handlers(app)
    app.dependency_overrides[deps.current_user] = lambda: current

    @app.get("/probe")
    def probe(u: dict = Depends(deps.require_permission(code))):
        return {"ok": True}

    return TestClient(app)


def test_require_permission_allows_a_holder_and_refuses_others():
    assert _app_with(perms.PROJECT_CREATE, user(MANAGER_PERMS)).get("/probe").status_code == 200
    denied = _app_with(perms.PROJECT_CREATE, user(MEMBER_PERMS)).get("/probe")
    assert denied.status_code == 403 and denied.json()["status"] == 403


def test_require_permission_unknown_code_is_refused_for_everyone(caplog):
    unknown = "NOT_A_REAL_PERMISSION"
    with caplog.at_level("ERROR", logger="tms.deps"):
        client = _app_with(unknown, user(ADMIN_PERMS | {unknown}))
    assert client.get("/probe").status_code == 403           # even with the code in the set
    assert "unknown permission code" in caplog.text           # and the typo is logged loudly


def test_require_permission_user_without_a_permission_set_is_refused():
    assert _app_with(perms.TASK_VIEW, {"user_id": 1, "role": "ADMIN"}).get("/probe").status_code == 403


# ------------------------------------------------------------------ resource scope (is_project_manager)

def test_admin_manages_any_project_without_membership():
    db = FakeDb(member=False)
    assert is_project_manager(db, user(ADMIN_PERMS), 7, perms.TASK_EDIT)
    assert db.calls == 0


def test_manager_needs_membership_of_that_project():
    assert is_project_manager(FakeDb(True), user(MANAGER_PERMS), 7, perms.TASK_EDIT)
    assert not is_project_manager(FakeDb(False), user(MANAGER_PERMS), 7, perms.TASK_EDIT)


def test_member_of_the_project_is_never_a_manager():
    # MEMBER holds TASK_STATUS_CHANGE, but membership + that permission must not make them a
    # manager: the status manager path is gated by TASK_EDIT, which MEMBER does not hold.
    member = user(MEMBER_PERMS)
    assert not is_project_manager(FakeDb(True), member, 7, perms.TASK_EDIT)
    assert not is_project_manager(FakeDb(True), member, 7, perms.TASK_ASSIGN)
    assert not is_project_manager(FakeDb(True), member, 7, perms.TASK_DELETE_ANY)
    assert not is_project_manager(FakeDb(True), member, 7, perms.ATTACHMENT_DELETE_ANY)


def test_manager_permission_missing_means_no_management_even_as_member():
    # A MANAGER whose TASK_ASSIGN grant was revoked can no longer assign, though still a member.
    u = user(MANAGER_PERMS - {perms.TASK_ASSIGN})
    assert not is_project_manager(FakeDb(True), u, 7, perms.TASK_ASSIGN)
    assert is_project_manager(FakeDb(True), u, 7, perms.TASK_EDIT)


def test_project_membership_and_visibility_follow_view_all():
    assert is_project_member(FakeDb(False), user(ADMIN_PERMS), 7)
    assert not is_project_member(FakeDb(False), user(MEMBER_PERMS), 7)
    assert is_project_member(FakeDb(True), user(MEMBER_PERMS), 7)
    assert task_visibility_clause(user(ADMIN_PERMS)) == ("1 = 1", {})
    assert project_visibility_clause(user(ADMIN_PERMS)) == ("1 = 1", {})
    clause, binds = task_visibility_clause(user(MANAGER_PERMS, user_id=9), "t")
    assert "project_members" in clause and binds == {"vis_user_id": 9}


def test_role_name_alone_no_longer_bypasses_visibility():
    # A user dict that says ADMIN but carries no permissions gets the member-scoped clause.
    clause, binds = task_visibility_clause({"user_id": 3, "role": "ADMIN"}, "t")
    assert "project_members" in clause and binds == {"vis_user_id": 3}
