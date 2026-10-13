import atexit
import datetime
import os
import re
import sqlite3
from contextlib import contextmanager
from typing import Any, Generator, Optional
from app.config import get_settings

_pool: Any = None
_sqlite_conn: Optional[sqlite3.Connection] = None



def _effective_url(database_url: Optional[str] = None) -> str:
    """Return effective database URL with automated zero-setup SQLite fallback for Vercel."""
    url = database_url or get_settings().DATABASE_URL
    # If on Vercel and no cloud Postgres is specified (unset, empty, or localhost/127.0.0.1)
    if os.getenv("VERCEL") and (
        not url or "127.0.0.1" in url or "localhost" in url
    ):
        return "sqlite:////tmp/zerowaste.db"
    return url or ""


def is_sqlite(database_url: Optional[str] = None) -> bool:
    """Check if the target connection is SQLite."""
    return _effective_url(database_url).startswith("sqlite:")


def _sqlite_path(database_url: Optional[str] = None) -> str:
    url = _effective_url(database_url)
    if url.startswith("sqlite:////"):
        return "/" + url[len("sqlite:////"):].lstrip("/")
    if url.startswith("sqlite:///"):
        sub = url[len("sqlite:///"): ]
        if sub.startswith("./") or sub.startswith(".\\"):
            return os.path.abspath(sub)
        return sub
    if url.startswith("sqlite:"):
        return url[len("sqlite:"): ]
    return "/tmp/zerowaste.db"


def _convert_val(val: Any) -> Any:
    """Safely convert SQLite types to standard Python date/time objects if string matches."""
    if isinstance(val, str):
        # YYYY-MM-DD
        if len(val) == 10 and val[4] == "-" and val[7] == "-":
            try:
                return datetime.date.fromisoformat(val)
            except ValueError:
                pass
        # YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS
        elif len(val) >= 19 and val[4] == "-" and val[7] == "-" and (val[10] in ("T", " ")):
            try:
                return datetime.datetime.fromisoformat(val.replace(" ", "T"))
            except ValueError:
                pass
    return val


def _convert_row(row: Any) -> Any:
    if row is None:
        return None
    return tuple(_convert_val(v) for v in row)


class SqliteCursorWrapper:
    """Translates %s placeholders to ? and normalizes output types for SQLite."""

    def __init__(self, cursor: sqlite3.Cursor):
        self._cursor = cursor

    @staticmethod
    def _sanitize_sql(sql: str) -> str:
        # Strip Postgres-specific row-locking clauses like FOR UPDATE
        sql = re.sub(r'\s+FOR\s+UPDATE\b', '', sql, flags=re.IGNORECASE)
        return sql.replace("%s", "?")

    def execute(self, sql: str, params: Any = ()):
        sql = self._sanitize_sql(sql)
        if params is not None and len(params) > 0:
            # Convert any date/datetime/bool in params to strings/ints
            clean_params = []
            for p in params:
                if isinstance(p, (datetime.date, datetime.datetime)):
                    clean_params.append(p.isoformat())
                elif isinstance(p, bool):
                    clean_params.append(1 if p else 0)
                else:
                    clean_params.append(p)
            return self._cursor.execute(sql, tuple(clean_params))
        return self._cursor.execute(sql)

    def executemany(self, sql: str, rows: Any):
        sql = self._sanitize_sql(sql)
        clean_rows = []
        for row in rows:
            clean_row = []
            for p in row:
                if isinstance(p, (datetime.date, datetime.datetime)):
                    clean_row.append(p.isoformat())
                elif isinstance(p, bool):
                    clean_row.append(1 if p else 0)
                else:
                    clean_row.append(p)
            clean_rows.append(tuple(clean_row))
        return self._cursor.executemany(sql, clean_rows)

    def fetchone(self):
        row = self._cursor.fetchone()
        return _convert_row(row)

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [_convert_row(r) for r in rows]

    def fetchmany(self, size: int = 1):
        rows = self._cursor.fetchmany(size)
        return [_convert_row(r) for r in rows]

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    def close(self):
        try:
            self._cursor.close()
        except Exception:
            pass


class SqliteConnWrapper:
    """Wraps sqlite3.Connection with psycopg-like cursor/transaction surface."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def cursor(self):
        return SqliteCursorWrapper(self._conn.cursor())

    def execute(self, sql: str, params: Any = ()):
        cur = self.cursor()
        return cur.execute(sql, params)

    def commit(self):
        try:
            self._conn.commit()
        except Exception:
            pass

    def rollback(self):
        try:
            self._conn.rollback()
        except Exception:
            pass

    def close(self):
        pass  # Reused connection


def _get_sqlite_conn(database_url: Optional[str] = None) -> SqliteConnWrapper:
    global _sqlite_conn
    if _sqlite_conn is None:
        path = _sqlite_path(database_url)
        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, exist_ok=True)
        _sqlite_conn = sqlite3.connect(path, timeout=30.0, check_same_thread=False)
        try:
            _sqlite_conn.execute("PRAGMA journal_mode=WAL;")
            _sqlite_conn.execute("PRAGMA foreign_keys=ON;")
        except Exception:
            pass
    return SqliteConnWrapper(_sqlite_conn)


def get_pool(database_url: Optional[str] = None):
    """Initialize or return the global connection pool for Postgres."""
    global _pool
    if _pool is None:
        url = _effective_url(database_url)
        if url.startswith("sqlite:"):
            return None
        from psycopg_pool import ConnectionPool
        _pool = ConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=3,
            open=True,
            timeout=10.0,
        )
    return _pool


def close_pool() -> None:
    """Close all pooled connections or SQLite instances."""
    global _pool, _sqlite_conn
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None
    if _sqlite_conn is not None:
        try:
            _sqlite_conn.close()
        except Exception:
            pass
        _sqlite_conn = None


atexit.register(close_pool)


@contextmanager
def get_db_connection(database_url: Optional[str] = None):
    """Provide a transactional connection."""
    if is_sqlite(database_url):
        conn = _get_sqlite_conn(database_url)
        yield conn
    else:
        pool = get_pool(database_url)
        with pool.connection() as conn:
            yield conn


@contextmanager
def get_db_cursor(database_url: Optional[str] = None):
    """Provide a transactional cursor with automatic commit/rollback."""
    if is_sqlite(database_url):
        conn = _get_sqlite_conn(database_url)
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    else:
        with get_db_connection(database_url) as conn:
            with conn.cursor() as cur:
                yield cur
            conn.commit()


def check_db_health(database_url: Optional[str] = None) -> bool:
    """Verify database connection liveness."""
    try:
        with get_db_cursor(database_url) as cur:
            cur.execute("SELECT 1;")
            result = cur.fetchone()
            return result is not None and result[0] == 1
    except Exception:
        return False
