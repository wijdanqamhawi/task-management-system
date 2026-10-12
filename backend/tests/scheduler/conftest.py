"""Fixtures for the scheduled-notification tests. They run ONLY in the isolated TMS_TEST schema.

PKG_NOTIFICATION scans every task in the schema and commits internally, so it must never run
against TMS_USER (real or demo data). The guards, in order, are:

1. `backend/.env.test` must exist and name TMS_TEST (and differ from the app's TMS_DB_USER),
   checked BEFORE any connection is attempted. Without it every test here is skipped.
2. One connection attempt, no retries (a bad password must not lock the account).
3. `SYS_CONTEXT('USERENV','SESSION_USER')` must be TMS_TEST, re-checked before every test and
   every time the job opens a connection.
4. The schema must hold only ZZTEST rows and have the required objects installed.
5. The application's connection pool must be uninitialised, so nothing can reach TMS_USER.
6. Tests here may not use the TMS_USER fixtures (anon, login, dbc, app, new_project).
"""
from contextlib import contextmanager
from pathlib import Path

import oracledb
import pytest
from dotenv import dotenv_values

from app import db as appdb
from app.db import Db
from tests.scheduler import isolation

BACKEND_DIR = Path(__file__).resolve().parents[2]
FORBIDDEN_FIXTURES = {"anon", "login", "dbc", "app", "new_project"}
PLACEHOLDER_PASSWORDS = {"", "change-me"}


def pytest_configure(config):
    config.addinivalue_line("markers", "no_db: guard test that needs no database connection")


def _session_user(conn) -> str:
    cur = conn.cursor()
    try:
        cur.execute("SELECT SYS_CONTEXT('USERENV','SESSION_USER') FROM dual")
        return cur.fetchone()[0]
    finally:
        cur.close()


def _scalar(conn, sql, **binds):
    cur = conn.cursor()
    try:
        cur.execute(sql, binds)
        return cur.fetchone()[0]
    finally:
        cur.close()


@pytest.fixture(scope="session")
def tms_test_conn():
    env_file = BACKEND_DIR / ".env.test"
    if not env_file.is_file():
        pytest.skip("backend/.env.test not found: scheduler tests run only against the isolated "
                    "TMS_TEST schema (see database/test/README.md)")
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
        isolation.validate_session(_session_user(conn))
        have = {r[0] for r in _rows(conn, "SELECT table_name FROM user_tables")}
        valid_pkgs = {r[0] for r in _rows(
            conn, "SELECT object_name FROM user_objects WHERE object_type = 'PACKAGE BODY' "
                  "AND status = 'VALID'")}
        foreign = (
            _scalar(conn, "SELECT COUNT(*) FROM users WHERE LOWER(email) NOT LIKE 'zztest%'")
            + _scalar(conn, "SELECT COUNT(*) FROM projects WHERE name NOT LIKE 'ZZTEST%'"))
        isolation.validate_contents(
            set(isolation.REQUIRED_TABLES) - have,
            set(isolation.REQUIRED_PACKAGES) - valid_pkgs, foreign)
    except isolation.IsolationError as exc:
        conn.close()
        pytest.exit(f"ISOLATION GUARD: {exc}", returncode=2)
    except Exception as exc:
        conn.close()
        pytest.exit(f"ISOLATION GUARD: could not verify TMS_TEST ({str(exc).splitlines()[0]})",
                    returncode=2)

    yield conn
    conn.close()


def _rows(conn, sql):
    cur = conn.cursor()
    try:
        cur.execute(sql)
        return cur.fetchall()
    finally:
        cur.close()


def _cleanup(conn):
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM notifications WHERE recipient_id IN "
                    "(SELECT user_id FROM users WHERE LOWER(email) LIKE 'zztest%')")
        cur.execute("DELETE FROM projects WHERE name LIKE 'ZZTEST%'")      # cascades tasks etc.
        cur.execute("DELETE FROM users WHERE LOWER(email) LIKE 'zztest%'")
        conn.commit()
    finally:
        cur.close()


@pytest.fixture(autouse=True)
def isolated(request, monkeypatch):
    """Applied to every test in tests/scheduler. Guard tests marked no_db skip the database."""
    if request.node.get_closest_marker("no_db"):
        yield None
        return

    forbidden = FORBIDDEN_FIXTURES & set(request.fixturenames)
    if forbidden:
        pytest.fail(f"scheduler tests must not use TMS_USER fixtures: {sorted(forbidden)}")
    conn = request.getfixturevalue("tms_test_conn")

    def verify():
        try:
            isolation.validate_session(_session_user(conn))
        except isolation.IsolationError as exc:
            pytest.exit(f"ISOLATION GUARD: {exc}", returncode=2)

    verify()
    assert appdb._pool is None, "the application connection pool must not be initialised here"

    @contextmanager
    def isolated_connection():
        verify()                       # also re-checked each time the job opens a connection
        try:
            yield Db(conn)
        finally:
            conn.rollback()

    # scheduler.run_once() calls app.db.connection(): hand it the TMS_TEST connection only.
    monkeypatch.setattr(appdb, "connection", isolated_connection)
    _cleanup(conn)
    yield conn
    _cleanup(conn)
