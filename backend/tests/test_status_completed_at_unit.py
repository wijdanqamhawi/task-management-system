"""change_status stamps completed_at from the status read AFTER the row lock. No database."""
import pytest

from app.modules.tasks import service as svc


@pytest.mark.parametrize("new,current,expected", [
    ("COMPLETED", "IN_PROGRESS", "TRUNC(SYSDATE)"),   # moved into COMPLETED: stamp today
    ("COMPLETED", "COMPLETED", "completed_at"),       # stays COMPLETED: keep (never invent a legacy NULL)
    ("COMPLETED", None, "TRUNC(SYSDATE)"),
    ("IN_PROGRESS", "COMPLETED", "NULL"),             # reopened: clear
    ("TO_DO", "TO_DO", "NULL"),
])
def test_completed_at_sql(new, current, expected):
    assert svc.completed_at_sql(new, current) == expected


class FakeDb:
    """Records the order of calls; the locked read reports `locked_status`."""
    def __init__(self, locked_status):
        self.locked_status, self.calls, self.updates = locked_status, [], []

    def scalar(self, sql, binds=None):
        if "FOR UPDATE" in sql:
            self.calls.append("lock")
            return 1
        if "status_code FROM tasks" in sql:
            self.calls.append("read-status")
            return self.locked_status
        raise AssertionError(sql)

    def execute(self, sql, binds=None):
        self.calls.append("update")
        self.updates.append(sql)
        return 1

    def commit(self):
        self.calls.append("commit")


def test_status_is_read_after_lock_not_from_the_stale_task(monkeypatch):
    # The task row read before the lock says IN_PROGRESS, but a concurrent request already
    # completed it: the locked read says COMPLETED, so completed_at must be KEPT, not re-stamped.
    stale = {"task_id": 1, "project_id": 1, "title": "T", "status": "IN_PROGRESS"}
    monkeypatch.setattr(svc, "require_task_visible", lambda *a: stale)
    monkeypatch.setattr(svc, "has_permission", lambda *a: True)
    monkeypatch.setattr(svc, "_notify_involved", lambda *a, **k: None)
    db = FakeDb("COMPLETED")
    svc.change_status(db, {"user_id": 9}, 1, "COMPLETED")
    assert db.calls[:3] == ["lock", "read-status", "update"]
    assert "completed_at = completed_at" in db.updates[0]
