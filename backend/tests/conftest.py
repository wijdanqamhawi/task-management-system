"""Test fixtures. Integration tests run against the REAL Oracle schema (research.md R-011)
using the demo accounts from database/seed/demo_data.sql (all share the password Password1!).

Every row a test creates is prefixed ZZTEST and removed again afterwards, so the demo data is
left exactly as it was found.
"""
import os

os.environ["TMS_SCHEDULER"] = "off"     # tests call the job explicitly; never in the background

import pytest
from fastapi.testclient import TestClient

from app import db as dbmod
from app.main import create_app

DEMO_PASSWORD = "Password1!"
ADMIN = "admin@example.org"
MANAGER = "m.saleh@example.org"        # manager of Payroll Migration + Helpdesk Portal
MANAGER2 = "n.darwish@example.org"     # manager of Network Audit
MEMBER = "a.hassan@example.org"        # member of projects 1 and 2 only
MEMBER_OTHER = "s.khalil@example.org"  # member of Network Audit only
INACTIVE = "y.nasser@example.org"


@pytest.fixture(scope="session")
def app():
    return create_app()


@pytest.fixture(scope="session")
def anon(app):
    try:
        client = TestClient(app)
        client.__enter__()               # runs the lifespan: opens the connection pool
    except Exception as exc:
        # Abort the whole run on the first failed connection. Retrying a bad login once per
        # test would trip Oracle's FAILED_LOGIN_ATTEMPTS limit and lock the account (ORA-28000).
        pytest.exit(f"Cannot connect to Oracle ({str(exc).splitlines()[0]}). "
                    "Check TMS_DB_* in backend/.env; not retrying.", returncode=2)
    try:
        yield client
    finally:
        client.__exit__(None, None, None)


@pytest.fixture()
def dbc(anon):
    with dbmod.connection() as conn:
        yield conn


def _cleanup(conn):
    from app.modules.attachments import storage
    storage.remove_quietly(r["stored_name"] for r in conn.query(
        "SELECT a.stored_name FROM attachments a JOIN tasks t ON t.task_id = a.task_id "
        "JOIN projects p ON p.project_id = t.project_id WHERE p.name LIKE 'ZZTEST%'"))
    conn.execute("DELETE FROM projects WHERE name LIKE 'ZZTEST%'")      # cascades tasks etc.
    conn.execute("DELETE FROM notifications WHERE recipient_id IN "
                 "(SELECT user_id FROM users WHERE email LIKE 'zztest%')")
    conn.execute("DELETE FROM users WHERE email LIKE 'zztest%'")
    conn.commit()


@pytest.fixture(autouse=True)
def clean_rows(request):
    if "anon" not in request.fixturenames and "login" not in request.fixturenames:
        yield                                  # pure unit test: no database involved
        return
    anon = request.getfixturevalue("anon")
    with dbmod.connection() as conn:
        _cleanup(conn)
    yield
    with dbmod.connection() as conn:
        _cleanup(conn)


@pytest.fixture()
def login(app, anon):
    """login(email) -> a TestClient with its own cookie jar, signed in as that user."""
    clients = []

    def _login(email: str, password: str = DEMO_PASSWORD) -> TestClient:
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, resp.text
        clients.append(client)
        return client

    yield _login
    for c in clients:
        c.close()


@pytest.fixture()
def new_project(login):
    """new_project(manager_client, *member_ids) -> project json."""
    def _create(client, member_ids=(), **overrides):
        body = {"name": "ZZTEST project", "status": "ACTIVE",
                "startDate": "2026-01-01", "endDate": "2026-12-31", **overrides}
        resp = client.post("/api/projects", json=body)
        assert resp.status_code == 201, resp.text
        project = resp.json()
        for uid in member_ids:
            assert client.post(f"/api/projects/{project['projectId']}/members",
                               json={"userId": uid}).status_code == 201
        return project
    return _create


def user_id(client: TestClient) -> int:
    return client.get("/api/auth/me").json()["userId"]
