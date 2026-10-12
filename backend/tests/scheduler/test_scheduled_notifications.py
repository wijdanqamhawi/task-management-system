"""Approaching-deadline and overdue notifications (FR-056, FR-057, FR-061; research.md R-007).

Runs ONLY in the isolated TMS_TEST schema (see conftest.py and database/test/README.md). The
schema holds nothing but the rows each test creates, so the job's exact counts can be asserted.

Due-date semantics ("Option K", documented in database/test/README.md):
  * DEADLINE: from 00:00 the day BEFORE the due date, until the task is completed or overdue.
  * OVERDUE:  from 00:00 the day AFTER the due date, until the task is completed.
Both are raised once per task and assignee, only for active assignees of incomplete tasks.
"""
import oracledb
import pytest

from app.common.paging import PageParams
from app.db import Db
from app.modules.notifications import scheduler
from app.modules.notifications import service as notifications
from tests.scheduler import isolation


class World:
    """Builds ZZTEST fixtures straight in TMS_TEST and reads the results back."""

    def __init__(self, conn):
        self.conn = conn
        self.db = Db(conn)
        self._n = 0

    # ---- building
    def _next(self):
        self._n += 1
        return self._n

    def user(self, tag, *, active=True, role="MEMBER") -> int:
        n = self._next()
        uid = self.db.insert(
            "INSERT INTO users (username, email, password_hash, full_name, role_id, is_active) "
            "VALUES (:u, :e, :p, :n, (SELECT role_id FROM roles WHERE role_name = :r), :a)",
            {"u": f"zzs{n}{tag}"[:50], "e": f"zztest.sched.{tag}.{n}@example.org",
             "p": "$2b$10$" + "x" * 53, "n": f"ZZTEST {tag}", "r": role,
             "a": "Y" if active else "N"}, "user_id")
        self.conn.commit()
        return uid

    def project(self, creator: int, members=()) -> int:
        n = self._next()
        pid = self.db.insert(
            "INSERT INTO projects (name, status, created_by) VALUES (:n, 'ACTIVE', :c)",
            {"n": f"ZZTEST sched project {n}", "c": creator}, "project_id")
        for uid in {creator, *members}:
            self.db.execute("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)",
                            {"p": pid, "u": uid})
        self.conn.commit()
        return pid

    def task(self, project: int, creator: int, *, due: int | None, status="TO_DO",
             assignees=(), title=None) -> int:
        n = self._next()
        due_sql = "TRUNC(SYSDATE) + :due" if due is not None else "NULL"
        binds = {"p": project, "t": title or f"ZZTEST sched task {n}", "s": status, "c": creator}
        if due is not None:
            binds["due"] = due
        tid = self.db.insert(
            "INSERT INTO tasks (project_id, title, status_id, priority_id, due_date, created_by) "
            "VALUES (:p, :t, (SELECT status_id FROM task_status WHERE status_code = :s), "
            f"(SELECT priority_id FROM task_priority WHERE priority_code = 'MEDIUM'), {due_sql}, :c)",
            binds, "task_id")
        for uid in assignees:
            self.assign(tid, uid, by=creator, commit=False)
        self.conn.commit()
        return tid

    def assign(self, task: int, user: int, by: int, commit=True):
        self.db.execute(
            "INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (:t, :u, :b)",
            {"t": task, "u": user, "b": by})
        if commit:
            self.conn.commit()

    def unassign(self, task: int, user: int):
        self.db.execute("DELETE FROM task_assignees WHERE task_id = :t AND user_id = :u",
                        {"t": task, "u": user})
        self.conn.commit()

    def set_status(self, task: int, status: str):
        self.db.execute(
            "UPDATE tasks SET status_id = (SELECT status_id FROM task_status WHERE status_code = :s) "
            "WHERE task_id = :t", {"s": status, "t": task})
        self.conn.commit()

    def set_due(self, task: int, offset: int):
        self.db.execute("UPDATE tasks SET due_date = TRUNC(SYSDATE) + :d WHERE task_id = :t",
                        {"d": offset, "t": task})
        self.conn.commit()

    def set_active(self, user: int, active: bool):
        self.db.execute("UPDATE users SET is_active = :a WHERE user_id = :u",
                        {"a": "Y" if active else "N", "u": user})
        self.conn.commit()

    # ---- reading
    def count(self, *, task=None, user=None, kind=None) -> int:
        where, binds = ["1 = 1"], {}
        for column, value, key in (("task_id", task, "t"), ("recipient_id", user, "u"),
                                   ("trigger_type", kind, "k")):
            if value is not None:
                where.append(f"{column} = :{key}")
                binds[key] = value
        return self.db.scalar(f"SELECT COUNT(*) FROM notifications WHERE {' AND '.join(where)}", binds)

    def total_scheduled(self) -> int:
        return self.db.scalar(
            "SELECT COUNT(*) FROM notifications WHERE trigger_type IN ('DEADLINE','OVERDUE')")

    def message(self, task: int, user: int, kind: str) -> str:
        return self.db.scalar(
            "SELECT message FROM notifications WHERE task_id = :t AND recipient_id = :u "
            "AND trigger_type = :k", {"t": task, "u": user, "k": kind})

    def date_text(self, offset: int) -> str:
        return self.db.scalar("SELECT TO_CHAR(TRUNC(SYSDATE) + :d, 'YYYY-MM-DD') FROM dual",
                              {"d": offset})

    def run_job(self) -> dict:
        return scheduler.run_once()


@pytest.fixture()
def world(isolated):
    return World(isolated)


@pytest.fixture()
def team(world):
    """A manager, two active members and a project they all belong to."""
    manager = world.user("mgr", role="MANAGER")
    a1, a2 = world.user("a1"), world.user("a2")
    return {"w": world, "manager": manager, "a1": a1, "a2": a2,
            "project": world.project(manager, [a1, a2])}


# ----------------------------------------------------------------- 24-hour reminder (FR-056)

def test_deadline_window_follows_option_k(team):
    w, p, a1, mgr = team["w"], team["project"], team["a1"], team["manager"]
    today = w.task(p, mgr, due=0, assignees=[a1])        # due today
    tomorrow = w.task(p, mgr, due=1, assignees=[a1])     # due tomorrow
    in_two_days = w.task(p, mgr, due=2, assignees=[a1])  # window not open yet
    far = w.task(p, mgr, due=30, assignees=[a1])

    assert w.run_job() == {"deadline": 2, "overdue": 0}

    assert w.count(task=today, user=a1, kind="DEADLINE") == 1
    assert w.count(task=tomorrow, user=a1, kind="DEADLINE") == 1
    assert w.count(task=in_two_days) == 0 and w.count(task=far) == 0
    assert w.message(tomorrow, a1, "DEADLINE").endswith(f"is due on {w.date_text(1)}")
    assert w.count(task=today, kind="OVERDUE") == 0       # due today is not yet overdue


def test_overdue_starts_the_day_after_the_due_date(team):
    w, p, a1, mgr = team["w"], team["project"], team["a1"], team["manager"]
    yesterday = w.task(p, mgr, due=-1, assignees=[a1])
    long_ago = w.task(p, mgr, due=-9, assignees=[a1])
    today = w.task(p, mgr, due=0, assignees=[a1])

    assert w.run_job() == {"deadline": 1, "overdue": 2}

    assert w.count(task=yesterday, user=a1, kind="OVERDUE") == 1
    assert w.count(task=long_ago, user=a1, kind="OVERDUE") == 1
    assert w.count(task=today, kind="OVERDUE") == 0
    # An already-overdue task is never given an "approaching" reminder as well.
    assert w.count(task=yesterday, kind="DEADLINE") == 0 and w.count(task=long_ago, kind="DEADLINE") == 0
    assert "is overdue" in w.message(long_ago, a1, "OVERDUE")


# ----------------------------------------------------------------- idempotency

def test_repeated_runs_create_nothing_new(team):
    w, p, a1, a2, mgr = team["w"], team["project"], team["a1"], team["a2"], team["manager"]
    soon = w.task(p, mgr, due=1, assignees=[a1, a2])
    late = w.task(p, mgr, due=-3, assignees=[a1, a2])

    assert w.run_job() == {"deadline": 2, "overdue": 2}
    after_first = w.total_scheduled()
    assert after_first == 4

    for _ in range(3):
        assert w.run_job() == {"deadline": 0, "overdue": 0}
    assert w.total_scheduled() == after_first
    assert w.count(task=soon, user=a1, kind="DEADLINE") == 1
    assert w.count(task=late, user=a2, kind="OVERDUE") == 1      # still one, however long it stays overdue


def test_database_index_blocks_a_duplicate_scheduled_notification(team):
    w, p, a1, mgr = team["w"], team["project"], team["a1"], team["manager"]
    late = w.task(p, mgr, due=-2, assignees=[a1])
    w.run_job()
    with pytest.raises(oracledb.IntegrityError) as err:
        w.db.execute("INSERT INTO notifications (recipient_id, task_id, trigger_type, message) "
                     "VALUES (:u, :t, 'OVERDUE', 'duplicate')", {"u": a1, "t": late})
    assert "ORA-00001" in str(err.value) and "UQ_NOTIFICATIONS_SCHEDULED" in str(err.value).upper()
    w.conn.rollback()
    assert w.count(task=late, user=a1, kind="OVERDUE") == 1


def test_changed_due_date_does_not_re_raise_a_reminder(team):
    w, p, a1, mgr = team["w"], team["project"], team["a1"], team["manager"]
    task = w.task(p, mgr, due=1, assignees=[a1])
    assert w.run_job() == {"deadline": 1, "overdue": 0}
    w.set_due(task, 30)                                   # pushed far out ...
    w.set_due(task, 1)                                    # ... and approaching again
    assert w.run_job() == {"deadline": 0, "overdue": 0}   # once per task, as FR-056 requires
    assert w.count(task=task, kind="DEADLINE") == 1


# ----------------------------------------------------------------- who is notified

def test_completed_tasks_are_skipped(team):
    w, p, a1, mgr = team["w"], team["project"], team["a1"], team["manager"]
    done_soon = w.task(p, mgr, due=1, status="COMPLETED", assignees=[a1])
    done_late = w.task(p, mgr, due=-4, status="COMPLETED", assignees=[a1])
    reminded = w.task(p, mgr, due=1, assignees=[a1])

    assert w.run_job() == {"deadline": 1, "overdue": 0}
    assert w.count(task=done_soon) == 0 and w.count(task=done_late) == 0

    w.set_due(reminded, -2)                               # becomes overdue ...
    w.set_status(reminded, "COMPLETED")                   # ... but was completed first
    assert w.run_job() == {"deadline": 0, "overdue": 0}


def test_only_assignees_are_notified_each_exactly_once(team):
    w, p, mgr, a1, a2 = team["w"], team["project"], team["manager"], team["a1"], team["a2"]
    bystander = w.user("bystander")
    w.db.execute("INSERT INTO project_members (project_id, user_id) VALUES (:p, :u)",
                 {"p": p, "u": bystander})
    w.conn.commit()
    task = w.task(p, mgr, due=-1, assignees=[a1, a2])    # manager created it but is not assigned

    assert w.run_job() == {"deadline": 0, "overdue": 2}
    assert w.count(task=task, user=a1, kind="OVERDUE") == 1
    assert w.count(task=task, user=a2, kind="OVERDUE") == 1
    assert w.count(user=mgr) == 0 and w.count(user=bystander) == 0    # creator / other members: none


def test_unassigned_and_undated_tasks_notify_nobody(team):
    w, p, a1, mgr = team["w"], team["project"], team["a1"], team["manager"]
    w.task(p, mgr, due=-5, assignees=[])                  # overdue but nobody assigned
    w.task(p, mgr, due=None, assignees=[a1])              # assigned but no due date
    assert w.run_job() == {"deadline": 0, "overdue": 0}
    assert w.total_scheduled() == 0


def test_deactivated_assignee_gets_nothing_until_reactivated(team):
    w, p, a1, a2, mgr = team["w"], team["project"], team["a1"], team["a2"], team["manager"]
    task = w.task(p, mgr, due=-1, assignees=[a1, a2])
    w.set_active(a2, False)                               # FR-061

    assert w.run_job() == {"deadline": 0, "overdue": 1}
    assert w.count(task=task, user=a1) == 1 and w.count(task=task, user=a2) == 0

    w.set_active(a2, True)
    assert w.run_job() == {"deadline": 0, "overdue": 1}   # a1 is not repeated; a2 now gets theirs
    assert w.count(task=task, user=a2, kind="OVERDUE") == 1
    assert w.count(task=task, user=a1, kind="OVERDUE") == 1


def test_unassigned_user_is_not_notified(team):
    w, p, a1, a2, mgr = team["w"], team["project"], team["a1"], team["a2"], team["manager"]
    task = w.task(p, mgr, due=-1, assignees=[a1, a2])
    w.unassign(task, a2)
    assert w.run_job() == {"deadline": 0, "overdue": 1}
    assert w.count(task=task, user=a2) == 0


# ----------------------------------------------------------------- unread counts (FR-060)

def test_unread_count_follows_new_read_and_read_all(team):
    w, p, a1, a2, mgr = team["w"], team["project"], team["a1"], team["a2"], team["manager"]
    t_late = w.task(p, mgr, due=-1, assignees=[a1])
    t_soon = w.task(p, mgr, due=1, assignees=[a1, a2])
    me1 = {"user_id": a1, "role": "MEMBER"}
    me2 = {"user_id": a2, "role": "MEMBER"}

    assert notifications.unread_count(w.db, me1) == {"unreadCount": 0}
    assert w.run_job() == {"deadline": 2, "overdue": 1}

    assert notifications.unread_count(w.db, me1) == {"unreadCount": 2}      # overdue + deadline
    assert notifications.unread_count(w.db, me2) == {"unreadCount": 1}
    listed = notifications.list_for(w.db, me1, PageParams(page=0, size=20), unread_only=True)
    assert listed["totalElements"] == 2
    assert {n["triggerType"] for n in listed["content"]} == {"DEADLINE", "OVERDUE"}
    assert {n["taskId"] for n in listed["content"]} == {t_late, t_soon}

    first = listed["content"][0]["notificationId"]
    assert notifications.mark_read(w.db, me1, first)["isRead"] is True
    assert notifications.unread_count(w.db, me1) == {"unreadCount": 1}
    assert notifications.unread_count(w.db, me2) == {"unreadCount": 1}      # others unaffected

    assert notifications.mark_all_read(w.db, me1) == {"updated": 1}
    assert notifications.unread_count(w.db, me1) == {"unreadCount": 0}
    assert w.run_job() == {"deadline": 0, "overdue": 0}                     # reading does not re-raise
    assert notifications.unread_count(w.db, me1) == {"unreadCount": 0}


# ----------------------------------------------------------------- the job itself

def test_job_runs_inside_tms_test_and_reports_integer_counts(team):
    w = team["w"]
    result = w.run_job()
    assert set(result) == {"deadline", "overdue"}
    assert all(isinstance(v, int) for v in result.values())
    assert w.db.scalar("SELECT SYS_CONTEXT('USERENV','SESSION_USER') FROM dual") == "TMS_TEST"


# ----------------------------------------------------------------- guards (no database)

@pytest.mark.no_db
def test_config_guard_accepts_only_tms_test_distinct_from_the_app_user():
    assert isolation.validate_config("tms_test", "TMS_USER") == "TMS_TEST"
    for bad in (None, "", "TMS_USER", "tms_other", "SYSTEM"):
        with pytest.raises(isolation.IsolationError):
            isolation.validate_config(bad, "TMS_USER")
    with pytest.raises(isolation.IsolationError):          # same account as the application
        isolation.validate_config("TMS_TEST", "tms_test")


@pytest.mark.no_db
def test_session_guard_rejects_any_other_database_user():
    isolation.validate_session("TMS_TEST")
    for bad in (None, "", "TMS_USER", "SYS", "PDBADMIN"):
        with pytest.raises(isolation.IsolationError):
            isolation.validate_session(bad)


@pytest.mark.no_db
def test_contents_guard_requires_install_and_refuses_foreign_data():
    isolation.validate_contents(set(), set(), 0)
    with pytest.raises(isolation.IsolationError):
        isolation.validate_contents({"TASKS"}, set(), 0)
    with pytest.raises(isolation.IsolationError):
        isolation.validate_contents(set(), {"PKG_NOTIFICATION"}, 0)
    with pytest.raises(isolation.IsolationError):
        isolation.validate_contents(set(), set(), 3)


@pytest.mark.no_db
def test_application_pool_is_never_initialised_by_this_suite():
    from app import db as appdb
    assert appdb._pool is None
