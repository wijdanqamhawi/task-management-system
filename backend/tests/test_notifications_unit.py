"""Notification read/unread unit tests: no database, no network (a recording fake stands in for Db).

They pin the parts of the contract the Original UI's read/unread behaviour depends on:
  * PUT /api/notifications/{id}/read touches exactly that row, only for its recipient, commits,
    and answers `isRead: true`; someone else's (or a missing) id is 404 and writes nothing;
  * PUT /api/notifications/read-all updates only the caller's unread rows;
  * GET ?unreadOnly=true filters on is_read = 'N'; the list and the badge count use the same
    recipient + visibility rules, and the count is `{"unreadCount": n}`;
  * the Db layer turns the CHAR(1) 'Y'/'N' column into a JSON boolean (the UI reads `isRead`).
Persistence in Oracle itself is covered by tests/test_dashboard_notifications.py (needs Oracle).
"""
from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import db as dbmod
from app.common.permissions import PROJECT_VIEW_ALL
from app.db import get_db
from app.deps import current_user
from app.errors import install_handlers
from app.modules.notifications.router import router

ME = {"user_id": 7, "permissions": frozenset({PROJECT_VIEW_ALL})}
NOW = datetime(2026, 11, 3, 10, 0, 0)


class FakeDb:
    """Records every statement. `rows` maps a notification id to its row (owned by user 7)."""

    def __init__(self, rows=None, unread=0):
        self.rows = rows or {}
        self.unread = unread
        self.executed: list[tuple[str, dict]] = []
        self.lookups: list[str] = []
        self.commits = 0

    def one(self, sql, params=None):
        self.lookups.append(sql)
        row = self.rows.get(params["id"])
        return dict(row) if row and params["me"] == 7 else None      # recipient-only lookup

    def query(self, sql, params=None):
        self.executed.append((sql, params or {}))
        return [dict(r) for r in self.rows.values()]

    def scalar(self, sql, params=None):
        self.executed.append((sql, params or {}))
        return self.unread if "COUNT(*)" in sql and "is_read = 'N'" in sql else len(self.rows)

    def execute(self, sql, params=None):
        self.executed.append((sql, params or {}))
        return 3

    def commit(self):
        self.commits += 1


def _row(nid, is_read=False):
    return {"notification_id": nid, "task_id": 100 + nid, "trigger_type": "UPDATE",
            "message": f"m{nid}", "is_read": is_read, "created_at": NOW}


def _client(fake, user=ME):
    app = FastAPI()
    install_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: fake
    app.dependency_overrides[current_user] = lambda: user
    return TestClient(app)


def _writes(fake):
    return [(s, p) for s, p in fake.executed if s.lstrip().upper().startswith("UPDATE")]


def test_mark_one_read_updates_only_that_row_and_commits():
    fake = FakeDb({1: _row(1), 2: _row(2)})
    r = _client(fake).put("/api/notifications/1/read")
    assert r.status_code == 200
    body = r.json()
    assert body["notificationId"] == 1 and body["isRead"] is True and body["taskId"] == 101
    writes = _writes(fake)
    assert len(writes) == 1
    sql, params = writes[0]
    assert "is_read = 'Y'" in sql and "notification_id = :id" in sql
    assert params == {"id": 1}                       # notification 2 is never touched
    assert fake.commits == 1


def test_mark_read_of_someone_elses_or_missing_notification_is_404_and_writes_nothing():
    fake = FakeDb({1: _row(1)})
    other = {"user_id": 99, "permissions": frozenset()}
    assert _client(fake, other).put("/api/notifications/1/read").status_code == 404
    assert _client(fake).put("/api/notifications/555/read").status_code == 404
    assert _writes(fake) == [] and fake.commits == 0
    # the fake only mimics the recipient rule, so also pin that the real lookup SQL enforces it
    assert fake.lookups and all("recipient_id = :me" in s for s in fake.lookups)


def test_read_all_only_touches_callers_unread_rows():
    fake = FakeDb()
    r = _client(fake).put("/api/notifications/read-all")
    assert r.status_code == 200 and r.json() == {"updated": 3}
    sql, params = _writes(fake)[0]
    assert "recipient_id = :me" in sql and "is_read = 'N'" in sql and params == {"me": 7}
    assert fake.commits == 1


def test_list_shape_and_unread_only_filter():
    fake = FakeDb({1: _row(1), 2: _row(2, True)})
    c = _client(fake)
    page = c.get("/api/notifications", params={"unreadOnly": "true"}).json()
    assert set(page) == {"content", "page", "size", "totalElements", "totalPages"}
    assert set(page["content"][0]) == {"notificationId", "taskId", "triggerType", "message",
                                       "isRead", "createdAt"}
    assert any("n.is_read = 'N'" in s for s, _ in fake.executed)
    fake.executed.clear()
    c.get("/api/notifications")
    assert not any("n.is_read = 'N'" in s for s, _ in fake.executed)
    assert all("n.recipient_id = :me" in s for s, _ in fake.executed)


def test_unread_count_shape_and_same_rules_as_list():
    fake = FakeDb(unread=4)
    assert _client(fake).get("/api/notifications/unread-count").json() == {"unreadCount": 4}
    sql, params = fake.executed[0]
    assert "n.recipient_id = :me" in sql and "n.is_read = 'N'" in sql and params["me"] == 7
    assert "n.task_id IS NULL OR" in sql             # same visibility rule as the list (FR-061)


def test_notification_endpoints_require_a_session():
    from starlette.middleware.sessions import SessionMiddleware
    app = FastAPI()
    app.add_middleware(SessionMiddleware, secret_key="unit-test-only")
    install_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: FakeDb()      # the real current_user is left in place
    c = TestClient(app)
    for method, path in [("get", "/api/notifications"), ("get", "/api/notifications/unread-count"),
                         ("put", "/api/notifications/1/read"), ("put", "/api/notifications/read-all")]:
        assert getattr(c, method)(path).status_code == 401, path


@pytest.mark.parametrize("raw,expected", [("Y", True), ("N", False)])
def test_db_layer_exposes_is_read_as_boolean(raw, expected):
    assert dbmod._convert("is_read", raw) is expected
