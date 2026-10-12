"""Pure guard logic for the isolated scheduler tests (no database, no pytest imports).

PKG_NOTIFICATION scans a whole schema and commits internally, so these tests may only ever run
in the dedicated TMS_TEST schema. Every check here is cheap and fail-closed.
"""
REQUIRED_USER = "TMS_TEST"

REQUIRED_TABLES = (
    "ROLES", "TASK_STATUS", "TASK_PRIORITY", "USERS", "PROJECTS", "PROJECT_MEMBERS",
    "TASKS", "TASK_ASSIGNEES", "NOTIFICATIONS",
)
REQUIRED_PACKAGES = ("PKG_NOTIFICATION",)

INSTALL_HINT = "See database/test/README.md (steps 1-3) to create and install TMS_TEST."


class IsolationError(Exception):
    """The environment is not provably the isolated test schema: do not run anything."""


def validate_config(test_user: str | None, app_user: str | None) -> str:
    """Check the CONFIGURED users before any connection is attempted. Returns the user."""
    user = (test_user or "").strip().upper()
    if not user:
        raise IsolationError("TMS_TEST_DB_USER is not set in backend/.env.test.")
    if user != REQUIRED_USER:
        raise IsolationError(
            f"TMS_TEST_DB_USER is {user!r}; the scheduler tests only run as {REQUIRED_USER}.")
    if app_user and app_user.strip().upper() == user:
        raise IsolationError(
            "TMS_TEST_DB_USER equals the application's TMS_DB_USER; refusing to continue.")
    return user


def validate_session(session_user: str | None) -> None:
    """Check the user the database actually authenticated us as."""
    if (session_user or "").upper() != REQUIRED_USER:
        raise IsolationError(
            f"Connected as {session_user!r}, not {REQUIRED_USER}. Nothing was run.")


def validate_contents(missing_tables, invalid_packages, foreign_rows: int) -> None:
    if missing_tables or invalid_packages:
        raise IsolationError(
            f"TMS_TEST is not installed correctly (missing tables: {sorted(missing_tables)}, "
            f"missing/invalid packages: {sorted(invalid_packages)}). {INSTALL_HINT}")
    if foreign_rows:
        raise IsolationError(
            f"TMS_TEST holds {foreign_rows} row(s) that are not ZZTEST test data. Refusing to "
            "run the scheduler over them. Use an empty schema (no demo_data.sql).")
