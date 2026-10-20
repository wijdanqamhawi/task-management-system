"""Fixtures for the RBAC integration tests. They run ONLY against the isolated TMS_TEST schema.

Unlike the older integration tests (which use the TMS_USER demo data), these create their own
ZZTEST users, project and tasks, so nothing in TMS_USER is read or written. Guards, in order:

1. `backend/.env.test` must exist and name TMS_TEST (and differ from the app's TMS_DB_USER),
   checked before any connection. Without it every test here is skipped.
2. One connection attempt and no retries (a bad password must not lock the account).
3. SESSION_USER must be TMS_TEST on that connection AND again on the application's pool; any
   other schema aborts the whole run.
4. The schema must hold only ZZTEST rows, with the RBAC tables installed and seeded (21/47).
5. The application pool must be uninitialised when the fixture starts, and the scheduler must be
   off. The app settings are pointed at TMS_TEST *before* the pool is created.
6. Tests here may not use the TMS_USER fixtures (anon, login, dbc, app, new_project).

Run on its own:  python -m pytest tests/rbac -p no:cacheprovider
(Do not combine it with the TMS_USER suite: the connection pool is process-wide.)
"""
import dataclasses
import os
from pathlib import Path

import oracledb
import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

from app import config
from app import db as appdb
from app.main import create_app
from app.security import hash_password
from tests.scheduler import isolation

BACKEND_DIR = Path(__file__).resolve().parents[2]
FORBIDDEN_FIXTURES = {"anon", "login", "dbc", "app", "new_project"}
PLACEHOLDER_PASSWORDS = {"", "change-me"}
PASSWORD = "Passw0rd!"
RBAC_TABLES = ("ROLES", "USERS", "PROJECTS", "PROJECT_MEMBERS", "TASKS", "TASK_ASSIGNEES",
               "ATTACHMENTS", "NOTIFICATIONS", "TASK_STATUS", "TASK_PRIORITY", "PERMISSIONS",
               "ROLE_PERMISSIONS")


def _scalar(conn, sql):
    cur = conn.cursor()
    try:
        cur.execute(sql)
        return cur.fetchone()[0]
    finally:
        cur.close()


@pytest.fixture(autouse=True)
def _no_tms_user_fixtures(request):
    forbidden = FORBIDDEN_FIXTURES & set(request.fixturenames)
    if forbidden:
        pytest.fail(f"RBAC tests must not use TMS_USER fixtures: {sorted(forbidden)}")


@pytest.fixture(scope="session")
def tms_test_credentials():
    env_file = BACKEND_DIR / ".env.test"
    if not env_file.is_file():
        pytest.skip("backend/.env.test not found: RBAC tests run only against TMS_TEST "
                    "(see database/test/README.md)")
    values = dotenv_values(env_file)
    if (values.get("TMS_TEST_DB_PASSWORD") or "") in PLACEHOLDER_PASSWORDS:
        pytest.skip("TMS_TEST_DB_PASSWORD is not set in backend/.env.test")
    app_user = (dotenv_values(BACKEND_DIR / ".env").get("TMS_DB_USER")
                if (BACKEND_DIR / ".env").is_file() else None)
    try:
        user = isolation.validate_config(values.get("TMS_TEST_DB_USER"), app_user)
    except isolation.IsolationError as exc:
        pytest.exit(f"ISOLATION GUARD: {exc}", returncode=2)
    dsn = values.get("TMS_TEST_DB_DSN") or ""
    if not dsn:
        pytest.exit("ISOLATION GUARD: TMS_TEST_DB_DSN is not set in backend/.env.test", returncode=2)

    try:
        conn = oracledb.connect(user=user, password=values["TMS_TEST_DB_PASSWORD"], dsn=dsn)
    except Exception as exc:       # never retry: repeated bad logins lock the account
        pytest.exit(f"Cannot connect to TMS_TEST ({str(exc).splitlines()[0]}). Not retrying.",
                    returncode=2)
    try:
        isolation.validate_session(_scalar(conn, "SELECT SYS_CONTEXT('USERENV','SESSION_USER') FROM dual"))
        have = {r[0] for r in conn.cursor().execute("SELECT table_name FROM user_tables")}
        foreign = (_scalar(conn, "SELECT COUNT(*) FROM users WHERE LOWER(email) NOT LIKE 'zztest%'")
                   + _scalar(conn, "SELECT COUNT(*) FROM projects WHERE name NOT LIKE 'ZZTEST%'"))
        isolation.validate_contents(set(RBAC_TABLES) - have, set(), foreign)
        counts = (_scalar(conn, "SELECT COUNT(*) FROM permissions"),
                  _scalar(conn, "SELECT COUNT(*) FROM role_permissions"))
        if counts != (21, 47):
            pytest.exit(f"ISOLATION GUARD: TMS_TEST RBAC seed is {counts}, expected (21, 47). "
                        "Apply database/migrations/001_rbac_permissions.sql to TMS_TEST.",
                        returncode=2)
    except isolation.IsolationError as exc:
        pytest.exit(f"ISOLATION GUARD: {exc}", returncode=2)
    except Exception as exc:
        pytest.exit(f"ISOLATION GUARD: could not verify TMS_TEST ({str(exc).splitlines()[0]})",
                    returncode=2)
    finally:
        conn.close()
    return {"user": user, "password": values["TMS_TEST_DB_PASSWORD"], "dsn": dsn}


@pytest.fixture(scope="session")
def rbac_app(tms_test_credentials, tmp_path_factory):
    """The real FastAPI app, wired to TMS_TEST (settings replaced before the pool exists)."""
    if appdb._pool is not None:
        pytest.exit("ISOLATION GUARD: the application connection pool is already open.",
                    returncode=2)
    if os.environ.get("TMS_SCHEDULER", "").lower() != "off":
        pytest.exit("ISOLATION GUARD: TMS_SCHEDULER must be 'off' for tests.", returncode=2)
    original = config.get_settings()
    config._settings = dataclasses.replace(
        original, db_user=tms_test_credentials["user"],
        db_password=tms_test_credentials["password"], db_dsn=tms_test_credentials["dsn"],
        attachment_dir=tmp_path_factory.mktemp("rbac_attachments"))
    app = create_app()
    client = TestClient(app)
    try:
        client.__enter__()                       # lifespan opens the pool as TMS_TEST
        with appdb.connection() as db:
            isolation.validate_session(db.scalar("SELECT SYS_CONTEXT('USERENV','SESSION_USER') FROM dual"))
    except isolation.IsolationError as exc:
        appdb.close_pool()
        config._settings = original
        pytest.exit(f"ISOLATION GUARD: {exc}", returncode=2)
    except Exception as exc:
        appdb.close_pool()
        config._settings = original
        pytest.exit(f"Cannot start the app on TMS_TEST ({str(exc).splitlines()[0]}). Not retrying.",
                    returncode=2)
    try:
        yield app
    finally:
        client.__exit__(None, None, None)
        config._settings = original


@pytest.fixture(scope="session")
def password_hash():
    return hash_password(PASSWORD)


def cleanup(db):
    db.execute("DELETE FROM notifications WHERE recipient_id IN "
               "(SELECT user_id FROM users WHERE LOWER(email) LIKE 'zztest%')")
    db.execute("DELETE FROM projects WHERE name LIKE 'ZZTEST%'")        # cascades tasks etc.
    db.execute("DELETE FROM users WHERE LOWER(email) LIKE 'zztest%'")
    db.commit()


@pytest.fixture()
def world(rbac_app, password_hash):
    """ZZTEST users of every role, one project and tasks, and a signed-in client per user.

    admin (ADMIN, not a member) | mgr (MANAGER, member) | mgr_out (MANAGER, not a member)
    mem (MEMBER, member, assignee of t1) | mem2 (MEMBER, member, creator of t2)
    outsider (MEMBER, not a member) | target (MEMBER, not a member; subject of admin actions)
    t1: created by mgr, assigned to mem | t2: created by mem2 | t3: created by mgr, unassigned
    attachments: a_mem (by mem), a_mem2 (by mem2), a_mgr (by mgr), all on t1
    """
    with appdb.connection() as db:
        cleanup(db)
        role_ids = {r["role_name"]: r["role_id"] for r in db.query("SELECT role_id, role_name FROM roles")}
        ids = {}
        for key, role in [("admin", "ADMIN"), ("mgr", "MANAGER"), ("mgr_out", "MANAGER"),
                          ("mem", "MEMBER"), ("mem2", "MEMBER"), ("outsider", "MEMBER"),
                          ("target", "MEMBER")]:
            ids[key] = db.insert(
                "INSERT INTO users (username, email, password_hash, full_name, role_id, is_active) "
                "VALUES (:u, :e, :h, :n, :r, 'Y')",
                {"u": f"zztest_{key}", "e": f"zztest.{key}@example.org", "h": password_hash,
                 "n": f"ZZTEST {key}", "r": role_ids[role]}, "user_id")
        project = db.insert(
            "INSERT INTO projects (name, status, created_by) VALUES ('ZZTEST rbac', 'ACTIVE', :c)",
            {"c": ids["mgr"]}, "project_id")
        for key in ("mgr", "mem", "mem2"):
            db.execute("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)",
                       {"p": project, "u": ids[key]})
        todo = db.scalar("SELECT status_id FROM task_status WHERE status_code = 'TO_DO'")
        medium = db.scalar("SELECT priority_id FROM task_priority WHERE priority_code = 'MEDIUM'")
        tasks = {}
        for key, title, creator in [("t1", "ZZTEST task 1", "mgr"), ("t2", "ZZTEST task 2", "mem2"),
                                    ("t3", "ZZTEST task 3", "mgr")]:
            tasks[key] = db.insert(
                "INSERT INTO tasks (project_id, title, status_id, priority_id, created_by) "
                "VALUES (:p, :t, :s, :pr, :c)",
                {"p": project, "t": title, "s": todo, "pr": medium, "c": ids[creator]}, "task_id")
        db.execute("INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (:t, :u, :a)",
                   {"t": tasks["t1"], "u": ids["mem"], "a": ids["mgr"]})
        attachments = {}
        for key, uploader in [("a_mem", "mem"), ("a_mem2", "mem2"), ("a_mgr", "mgr")]:
            attachments[key] = db.insert(
                "INSERT INTO attachments (task_id, uploaded_by, original_name, stored_name, "
                "content_type, size_bytes) VALUES (:t, :u, :o, :s, 'text/plain', 1)",
                {"t": tasks["t1"], "u": ids[uploader], "o": f"{key}.txt",
                 "s": f"zztest-rbac-{key}-missing.txt"}, "attachment_id")
        db.commit()

    clients = {}
    for key in ids:
        client = TestClient(rbac_app)
        resp = client.post("/api/auth/login",
                           json={"email": f"zztest.{key}@example.org", "password": PASSWORD})
        assert resp.status_code == 200, resp.text
        clients[key] = client
    try:
        yield {"c": clients, "ids": ids, "project": project, "tasks": tasks,
               "attachments": attachments}
    finally:
        for client in clients.values():
            client.close()
        with appdb.connection() as db:
            cleanup(db)
