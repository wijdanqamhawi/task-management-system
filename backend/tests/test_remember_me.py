"""Remember me: cookie attributes, server-side lifetimes and logout (research.md R-002).

The integration tests only LOG IN as an existing demo account (a read of USERS) and write
nothing to the database. The cookie-policy tests at the bottom need no database at all.
"""
import base64
import json

import itsdangerous
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app import session as session_policy
from app.config import get_settings
from tests.conftest import ADMIN, DEMO_PASSWORD

HOUR, DAY = 3600, 86400


@pytest.fixture()
def client(app, anon):
    c = TestClient(app)
    yield c
    c.close()


def _login(client, remember=None):
    body = {"email": ADMIN, "password": DEMO_PASSWORD}
    if remember is not None:
        body["remember"] = remember
    r = client.post("/api/auth/login", json=body)
    assert r.status_code == 200, r.text
    return r.headers["set-cookie"]


def _move_time(monkeypatch, seconds):
    real = session_policy.now()
    monkeypatch.setattr(session_policy, "now", lambda: real + seconds)


def test_unchecked_login_sets_a_browser_session_cookie(client):
    for body in (None, False):
        cookie = _login(client, body).lower()
        assert cookie.startswith("tms_session=")
        assert "max-age" not in cookie and "expires" not in cookie    # dies with the browser
        assert "httponly" in cookie and "samesite=lax" in cookie


def test_checked_login_sets_a_30_day_persistent_cookie(client):
    cookie = _login(client, True)
    lower = cookie.lower()
    max_age = int(lower.split("max-age=")[1].split(";")[0])
    assert 30 * DAY - 60 <= max_age <= 30 * DAY
    assert "httponly" in lower and "samesite=lax" in lower


def test_unchecked_session_expires_server_side_after_8_hours(client, monkeypatch):
    _login(client, False)
    assert client.get("/api/auth/me").status_code == 200
    _move_time(monkeypatch, 8 * HOUR - 120)
    assert client.get("/api/auth/me").status_code == 200
    _move_time(monkeypatch, 8 * HOUR + 120)
    assert client.get("/api/auth/me").status_code == 401


def test_remembered_session_outlives_8_hours_but_not_30_days(client, monkeypatch):
    _login(client, True)
    _move_time(monkeypatch, 9 * HOUR)
    assert client.get("/api/auth/me").status_code == 200          # beyond the unchecked cap
    _move_time(monkeypatch, 29 * DAY)
    assert client.get("/api/auth/me").status_code == 200
    _move_time(monkeypatch, 30 * DAY + 120)
    assert client.get("/api/auth/me").status_code == 401


def test_ordinary_requests_do_not_extend_the_session(client, monkeypatch):
    """Fixed lifetime from login: the cookie is not re-issued (so not renewed) on later calls."""
    _login(client, True)
    _move_time(monkeypatch, 10 * DAY)
    assert "set-cookie" not in client.get("/api/auth/me").headers


@pytest.mark.parametrize("remember", [False, True])
def test_logout_clears_the_cookie_and_ends_the_session(client, remember):
    _login(client, remember)
    r = client.post("/api/auth/logout")
    assert r.status_code == 204
    cleared = r.headers["set-cookie"].lower()
    assert "tms_session=" in cleared and "expires=thu, 01 jan 1970" in cleared
    assert "max-age=" not in cleared or "max-age=0" in cleared
    assert client.get("/api/auth/me").status_code == 401


def test_cookie_from_before_this_feature_has_no_expiry_and_is_rejected(client):
    secret = get_settings().session_secret
    payload = base64.b64encode(json.dumps({"uid": 1}).encode("utf-8"))
    value = itsdangerous.TimestampSigner(secret).sign(payload).decode("utf-8")
    client.cookies.set("tms_session", value)
    assert client.get("/api/auth/me").status_code == 401


# --------------------------------------------------------------- no database needed

def _policy_app(secure: bool) -> FastAPI:
    app = FastAPI()
    session_policy.install_session(app, secret="unit-test-secret", secure=secure)

    @app.get("/set")
    def set_session(request: Request, remember: bool = False):
        request.session["uid"] = 1
        request.session["remember"] = remember
        request.session["exp"] = session_policy.now() + (30 * DAY if remember else 8 * HOUR)
        return {"ok": True}

    return app


def test_secure_flag_is_configurable_and_httponly_samesite_always_present():
    on = TestClient(_policy_app(True)).get("/set").headers["set-cookie"].lower()
    off = TestClient(_policy_app(False)).get("/set").headers["set-cookie"].lower()
    assert "secure" in on.split("; ") and "secure" not in off.split("; ")
    for cookie in (on, off):
        assert "httponly" in cookie and "samesite=lax" in cookie


def test_max_age_only_added_for_remembered_sessions():
    app = _policy_app(False)
    plain = TestClient(app).get("/set?remember=false").headers["set-cookie"].lower()
    kept = TestClient(app).get("/set?remember=true").headers["set-cookie"].lower()
    assert "max-age" not in plain
    assert 30 * DAY - 60 <= int(kept.split("max-age=")[1].split(";")[0]) <= 30 * DAY
