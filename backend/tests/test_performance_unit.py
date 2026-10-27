"""Performance evaluation unit tests: no database. They cover the schedule formula, the
"Not evaluable" rule, the per-user metrics and the who-may-view-whom permission gate.
"""
from datetime import date, datetime

import pytest

from app.common import permissions as perms
from app.errors import ApiError
from app.modules.performance import service as perf

START = date(2026, 1, 1)
DUE = date(2026, 1, 21)          # planned = 20 days


def sched(status="COMPLETED", start=START, due=DUE, completed=None):
    return perf.task_schedule(status, start, due, completed)


def row(status="COMPLETED", **kw):
    return {"status": status, **sched(status, **kw)}


# ------------------------------------------------------------------ formula

def test_early_by_five_days():
    s = sched(completed=date(2026, 1, 16))
    assert (s["plannedDuration"], s["actualDuration"], s["scheduleDifference"]) == (20, 15, -5)
    assert (s["scheduleStatus"], s["scheduleLabel"]) == ("EARLY", "5 days early")


def test_late_by_five_days():
    s = sched(completed=date(2026, 1, 26))
    assert (s["actualDuration"], s["scheduleDifference"]) == (25, 5)
    assert (s["scheduleStatus"], s["scheduleLabel"]) == ("LATE", "5 days late")


def test_on_time_and_singular_day():
    assert sched(completed=DUE)["scheduleLabel"] == "On time"
    assert sched(completed=date(2026, 1, 22))["scheduleLabel"] == "1 day late"


def test_oracle_datetime_values_are_reduced_to_days():
    s = sched(start=datetime(2026, 1, 1), due=datetime(2026, 1, 21),
              completed=datetime(2026, 1, 16, 9, 30))
    assert s["scheduleDifference"] == -5


@pytest.mark.parametrize("kw", [
    {"completed": None},                                   # legacy: completed, no completed_at
    {"completed": date(2026, 1, 10), "start": None},
    {"completed": date(2026, 1, 10), "due": None},
])
def test_missing_timing_data_is_not_evaluable(kw):
    s = sched(**kw)
    assert s["scheduleStatus"] == "NOT_EVALUABLE" and s["scheduleLabel"] == "Not evaluable"
    assert s["actualDuration"] is None and s["scheduleDifference"] is None


def test_unfinished_task_is_not_evaluated_even_with_a_stray_date():
    assert sched(status="IN_PROGRESS", completed=date(2026, 1, 10))["scheduleStatus"] == "NOT_EVALUABLE"


# ------------------------------------------------------------------ per-user metrics

def test_summary_counts_rates_and_average():
    tasks = [
        row(completed=date(2026, 1, 16)),                  # -5 early
        row(completed=DUE),                                #  0 on time
        row(completed=date(2026, 1, 26)),                  # +5 late
        row(completed=None),                               # completed, not evaluable
        row(status="IN_PROGRESS"),
    ]
    m = perf.summarize(tasks)
    assert (m["totalAssignedTasks"], m["totalCompletedTasks"]) == (5, 4)
    assert m["completionRate"] == 80.0
    assert (m["evaluableCompletedTasks"], m["notEvaluableCompletedTasks"]) == (3, 1)
    assert (m["earlyTasks"], m["onTimeTasks"], m["lateTasks"]) == (1, 1, 1)
    assert m["onTimeRate"] == 66.7                         # (1 + 1) / 3 evaluable, not / 4
    assert m["averageScheduleDifference"] == 0.0


def test_summary_without_evaluable_tasks_has_no_rate_or_average():
    m = perf.summarize([row(completed=None)])
    assert m["onTimeRate"] is None and m["averageScheduleDifference"] is None
    assert "enough timing data" in m["summary"]


def test_summary_of_nothing():
    m = perf.summarize([])
    assert m["completionRate"] is None and m["summary"] == "No assigned tasks yet."


def test_progress_uses_subtasks_else_status():
    assert perf._progress(4, 1, "IN_PROGRESS") == 25
    assert perf._progress(0, 0, "COMPLETED") == 100
    assert perf._progress(0, 0, "TO_DO") == 0


# ------------------------------------------------------------------ permission gate

class FakeDb:
    def __init__(self, shares_project: bool):
        self.shares = shares_project

    def scalar(self, sql, params=None):
        assert "project_members" in sql
        return 1 if self.shares else 0


MEMBER = {"user_id": 1, "permissions": frozenset({perms.TASK_VIEW, perms.PROJECT_VIEW})}
MANAGER = {"user_id": 2, "permissions": frozenset({perms.TASK_VIEW, perms.TASK_ASSIGN})}
ADMIN = {"user_id": 3, "permissions": frozenset(perms.ALL_PERMISSIONS)}


def status_of(call):
    with pytest.raises(ApiError) as e:
        call()
    return e.value.status


def test_anyone_may_view_themselves():
    perf._require_may_view(FakeDb(False), MEMBER, 1)


def test_member_cannot_view_others():
    assert status_of(lambda: perf._require_may_view(FakeDb(True), MEMBER, 2)) == 403


def test_manager_sees_only_users_sharing_a_project():
    perf._require_may_view(FakeDb(True), MANAGER, 9)
    assert status_of(lambda: perf._require_may_view(FakeDb(False), MANAGER, 9)) == 404


def test_admin_sees_everyone():
    perf._require_may_view(FakeDb(False), ADMIN, 9)
