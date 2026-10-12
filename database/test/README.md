# Isolated schema for scheduled-notification tests (TMS_TEST)

`PKG_NOTIFICATION` raises the two date-driven notifications (approaching deadline, overdue). It
scans **every task in the schema it runs in** and **commits internally**, so it cannot be
rolled back or limited to test rows. Running it against `TMS_USER` would write notifications for
real/demo data. These tests therefore run only against a separate, empty schema, `TMS_TEST`.

Nothing in `TMS_USER` is read or changed by this suite: the test connection is built from
`backend/.env.test`, the application's connection pool is never opened, and every test
re-checks that `SYS_CONTEXT('USERENV','SESSION_USER') = 'TMS_TEST'` before touching data.

## Step by step (PowerShell)

Prerequisites: Oracle Free is running and listening on `localhost:1521`, service `FREEPDB1`.

### 1. Create the schema (an administrator, once)

```powershell
$sql = "C:\app\wijdan\product\26ai\dbhomeFree\bin\sqlplus.exe"
cd "C:\Users\wijdan\OneDrive\Desktop\Task managment\database\test"
& $sql system@//localhost:1521/FREEPDB1 "@01_create_tms_test_user.sql"
```

You are asked for the `SYSTEM` password, then for the new `TMS_TEST` password. The script
refuses to run outside `FREEPDB1` or if `TMS_TEST` already exists.

### 2. Install the tables, packages and reference data as TMS_TEST

```powershell
$sql = "C:\app\wijdan\product\26ai\dbhomeFree\bin\sqlplus.exe"
$root = "C:\Users\wijdan\OneDrive\Desktop\Task managment\database"

cd "$root\ddl"
& $sql tms_test@//localhost:1521/FREEPDB1 "@run_all.sql"           # 13 tables, indexes, uq_notifications_scheduled

cd "$root\plsql"
& $sql tms_test@//localhost:1521/FREEPDB1 "@run_all.sql"           # PKG_DASHBOARD, PKG_NOTIFICATION

cd "$root\seed"
& $sql tms_test@//localhost:1521/FREEPDB1 "@reference_data.sql"    # roles, statuses, priorities ONLY
```

Do **not** run `demo_data.sql` here: the test guard refuses a schema that holds anything but
`ZZTEST` data.

### 3. Verify the installation

```powershell
& $sql tms_test@//localhost:1521/FREEPDB1
```

```sql
SELECT COUNT(*) FROM user_tables;                                    -- 13
SELECT object_name, object_type, status FROM user_objects
 WHERE object_type IN ('PACKAGE','PACKAGE BODY') ORDER BY 1, 2;      -- 4 rows, all VALID
SELECT COUNT(*) FROM roles;                                          -- 3
SELECT COUNT(*) FROM task_status;                                    -- 4
SELECT COUNT(*) FROM task_priority;                                  -- 3
SELECT COUNT(*) FROM users;                                          -- 0
EXIT
```

### 4. Point the tests at it

```powershell
cd "C:\Users\wijdan\OneDrive\Desktop\Task managment\backend"
Copy-Item .env.test.example .env.test
notepad .env.test        # set TMS_TEST_DB_PASSWORD to the password you chose
```

### 5. Run (only when ready)

```powershell
cd "C:\Users\wijdan\OneDrive\Desktop\Task managment\backend"
.\venv\Scripts\python.exe -m pytest tests\scheduler -p no:cacheprovider -v
```

Without `.env.test` every test in `tests/scheduler` is **skipped**, not run against anything
else. The unit tests of the guard itself always run (they need no database).

## Safety guards

| Guard | Where |
|---|---|
| Configured test user must be `TMS_TEST` and differ from `TMS_DB_USER` | `tests/scheduler/isolation.py` (before any connect) |
| One connection attempt, no retries (no account lockout) | `tests/scheduler/conftest.py` |
| `SESSION_USER` must be `TMS_TEST`, re-checked before every test | `tests/scheduler/conftest.py` |
| Schema must contain only `ZZTEST` rows | `tests/scheduler/conftest.py` |
| The application pool must be uninitialised (a stray call cannot reach `TMS_USER`) | `tests/scheduler/conftest.py` |
| Tests may not request the `TMS_USER` fixtures (`anon`, `login`, `dbc`, `app`) | `tests/scheduler/conftest.py` |
| The old whole-schema scheduler test only runs when the app itself is configured as `TMS_TEST` | `tests/test_dashboard_notifications.py` |

## Deadline and overdue semantics ("Option K")

Due dates are date-only. The notification rules, which the tests pin, are:

| Event | Raised when | Example: due on the 14th |
|---|---|---|
| **Approaching deadline** (FR-056) | From **00:00 on the day before** the due date, until the due day ends. Once per task and assignee. | 13th 00:00 onward |
| **Overdue** (FR-057) | From **00:00 on the day after** the due date, until the task is Completed. Once per task and assignee. | 15th 00:00 onward |

Further rules: a Completed task never notifies; only **assignees** are notified (not other
members or the creator); only **active** users; a task with no due date or no assignee notifies
nobody; a task already overdue gets `OVERDUE` and never `DEADLINE`; and changing a due date
after a reminder does not re-raise it. The job runs hourly (first run 15 s after start-up), so a
notification appears within about an hour of the boundary. Times are the **database server's**
clock (`SYSDATE`).

This matches the dashboard and API `overdue` flag, which also treat a task as overdue only
after its due day has ended. The PL/SQL in `database/plsql/pkg_notification.pkb` is unchanged.
