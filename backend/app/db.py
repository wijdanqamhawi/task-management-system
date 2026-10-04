"""Oracle access: a thin-mode connection pool and small raw-SQL helpers.

All SQL is written by hand with bind variables; there is no ORM (research.md R-001). One
connection per request. Services call `db.commit()` when a unit of work succeeds, and the
dependency rolls back anything left uncommitted if an error escapes.
"""
import re
from datetime import datetime
from contextlib import contextmanager
from typing import Any, Iterator

import oracledb

from app.config import get_settings
from app.errors import ApiError

oracledb.defaults.fetch_lobs = False      # CLOB columns arrive as str

_pool: oracledb.ConnectionPool | None = None


def init_pool() -> None:
    global _pool
    if _pool is None:
        s = get_settings()
        _pool = oracledb.create_pool(
            user=s.db_user, password=s.db_password, dsn=s.db_dsn,
            min=1, max=8, increment=1)


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close(force=True)
        _pool = None


def _convert(key: str, value: Any) -> Any:
    if isinstance(value, datetime):
        # DATE columns surface as datetime in python-oracledb; the contract wants a plain date.
        if key.endswith("_date"):
            return value.date()
        return value.replace(microsecond=0)
    if key.startswith("is_") and value in ("Y", "N"):
        return value == "Y"
    return value


class Db:
    """Thin wrapper around one pooled connection."""

    def __init__(self, conn: oracledb.Connection):
        self.conn = conn

    def _run(self, sql: str, params: dict | None):
        cur = self.conn.cursor()
        cur.execute(sql, params or {})
        return cur

    def query(self, sql: str, params: dict | None = None) -> list[dict]:
        cur = self._run(sql, params)
        try:
            cols = [c[0].lower() for c in cur.description]
            return [{k: _convert(k, v) for k, v in zip(cols, row)} for row in cur.fetchall()]
        finally:
            cur.close()

    def one(self, sql: str, params: dict | None = None) -> dict | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def scalar(self, sql: str, params: dict | None = None) -> Any:
        cur = self._run(sql, params)
        try:
            row = cur.fetchone()
            return row[0] if row else None
        finally:
            cur.close()

    def execute(self, sql: str, params: dict | None = None) -> int:
        cur = self._run(sql, params)
        try:
            return cur.rowcount
        finally:
            cur.close()

    def insert(self, sql: str, params: dict, id_column: str) -> int:
        """Run an INSERT and return the generated identity value (RETURNING ... INTO)."""
        cur = self.conn.cursor()
        try:
            out = cur.var(int)
            cur.execute(f"{sql} RETURNING {id_column} INTO :new_id", {**params, "new_id": out})
            return int(out.getvalue()[0])
        finally:
            cur.close()

    def call_cursor(self, function: str, *args: Any) -> list[dict]:
        """Call a PL/SQL function returning SYS_REFCURSOR and fetch its rows."""
        cur = self.conn.cursor()
        try:
            with _package_errors(function):
                ref = cur.callfunc(function, oracledb.CURSOR, list(args))
            cols = [c[0].lower() for c in ref.description]
            rows = [{k: _convert(k, v) for k, v in zip(cols, row)} for row in ref.fetchall()]
            ref.close()
            return rows
        finally:
            cur.close()

    def call_proc(self, procedure: str, in_args: list, out_count: int) -> list:
        """Call a PL/SQL procedure whose trailing `out_count` parameters are NUMBER OUT."""
        cur = self.conn.cursor()
        try:
            outs = [cur.var(int) for _ in range(out_count)]
            with _package_errors(procedure):
                cur.callproc(procedure, [*in_args, *outs])
            return [o.getvalue() for o in outs]
        finally:
            cur.close()

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()


@contextmanager
def _package_errors(name: str):
    """A missing package body is an installation problem, not a bug: say so clearly."""
    try:
        yield
    except oracledb.DatabaseError as exc:
        text = str(exc)
        if any(code in text for code in ("ORA-04067", "ORA-04068", "ORA-06508", "PLS-00201")):
            raise ApiError(
                503, f"{name.split('.')[0].upper()} is not installed in the database "
                     "(run database/plsql/run_all.sql)") from exc
        raise


@contextmanager
def connection() -> Iterator[Db]:
    """A pooled connection outside a request (used by the notification scheduler)."""
    assert _pool is not None, "Connection pool not initialised"
    conn = _pool.acquire()
    try:
        yield Db(conn)
    finally:
        try:
            conn.rollback()
        finally:
            _pool.release(conn)


def get_db() -> Iterator[Db]:
    """FastAPI dependency: one pooled connection per request."""
    assert _pool is not None, "Connection pool not initialised"
    conn = _pool.acquire()
    try:
        yield Db(conn)
    finally:
        try:
            conn.rollback()        # discard anything a service did not commit (e.g. GET requests)
        finally:
            _pool.release(conn)


def is_unique_violation(exc: Exception) -> bool:
    return isinstance(exc, oracledb.IntegrityError) and "ORA-00001" in str(exc)


def violated_constraint(exc: Exception) -> str | None:
    m = re.search(r"\(\w+\.(\w+)\)", str(exc))
    return m.group(1).upper() if m else None


def to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(p.title() for p in rest)


def camel(row: dict) -> dict:
    """snake_case row -> camelCase JSON object (one level)."""
    return {to_camel(k): v for k, v in row.items()}
