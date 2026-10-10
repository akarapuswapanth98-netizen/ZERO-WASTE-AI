"""Postgres primary (psycopg3, Supabase/Neon-compatible) + SQLite fallback for zero-setup demos.

- Postgres when DATABASE_URL is postgresql://... (production, tests).
- SQLite when DATABASE_URL is sqlite://<path> (e.g. sqlite:////tmp/zerowaste.db
  on Vercel serverless — stdlib only, /tmp is the only writable dir).
  Placeholders are written %s in app code and translated to ? for SQLite.

One connection per call (safe for Vercel serverless), autocommit on so every
statement is durable immediately and no rollback state ever leaks between calls.
"""
from __future__ import annotations
import os
import uuid
from . import config

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS stores (store_id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT);
CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, unit_cost REAL NOT NULL, unit_price REAL NOT NULL, shelf_life_days INTEGER NOT NULL, unit_weight_kg REAL NOT NULL, lead_time_days INTEGER DEFAULT 2, moq INTEGER DEFAULT 12);
CREATE TABLE IF NOT EXISTS inventory_batches (batch_id TEXT PRIMARY KEY, store_id TEXT NOT NULL, sku TEXT NOT NULL, qty_initial INTEGER NOT NULL, qty_on_hand INTEGER NOT NULL, received_date TEXT NOT NULL, expiry_date TEXT NOT NULL, unit_cost REAL NOT NULL);
CREATE TABLE IF NOT EXISTS sales_history (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, store_id TEXT NOT NULL, sku TEXT NOT NULL, date TEXT NOT NULL, units_sold INTEGER NOT NULL, unit_price REAL NOT NULL, promo INTEGER DEFAULT 0, UNIQUE(store_id, sku, date));
CREATE TABLE IF NOT EXISTS agent_runs (run_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, agent_name TEXT NOT NULL, store_id TEXT, sku TEXT, inputs_json TEXT, outputs_json TEXT, duration_ms INTEGER, status TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS recommendations (rec_id TEXT PRIMARY KEY, run_id TEXT, store_id TEXT NOT NULL, sku TEXT NOT NULL, action_type TEXT NOT NULL, quantity INTEGER NOT NULL, params_json TEXT, expected_loss REAL, expected_waste_avoided REAL, confidence REAL, explanation TEXT, alternatives_json TEXT, status TEXT DEFAULT 'proposed', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS planner_decisions (decision_id TEXT PRIMARY KEY, rec_id TEXT NOT NULL, decision TEXT NOT NULL, qty_adjusted INTEGER, reason TEXT, decided_by TEXT, decided_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sim_system_events (event_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, source TEXT NOT NULL, event_type TEXT NOT NULL, payload_json TEXT);
CREATE TABLE IF NOT EXISTS scenario_runs (scenario_id TEXT PRIMARY KEY, scenario_name TEXT NOT NULL, seed INTEGER NOT NULL, policy TEXT NOT NULL, params_json TEXT, metrics_json TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (log_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, details_json TEXT);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""

# SQLite variant: same shape, AUTOINCREMENT instead of GENERATED ALWAYS AS IDENTITY.
SCHEMA_SQL_SQLITE = SCHEMA_SQL.replace(
    "id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY",
    "id INTEGER PRIMARY KEY AUTOINCREMENT",
)


def _effective_url() -> str:
    """DATABASE_URL with a zero-setup Vercel fallback.

    Vercel serverless has no localhost Postgres. If the app runs on Vercel
    without an explicit Postgres URL (unset, or the local default pointing at
    127.0.0.1/localhost), fall back to an embedded SQLite file in /tmp
    (the only writable dir). Ephemeral across cold starts, but AUTO_SEED
    re-creates schema + core demo data, so the site stays healthy with zero
    dashboard setup. Set a real pooled Postgres DATABASE_URL for persistence.
    """
    url = config.DATABASE_URL or ""
    if os.getenv("VERCEL") and (
        not url or "127.0.0.1" in url or "localhost" in url
    ):
        return "sqlite:////tmp/zerowaste.db"
    return url


def is_sqlite() -> bool:
    return _effective_url().startswith("sqlite:")


def _sqlite_path() -> str:
    url = _effective_url()
    # sqlite:////tmp/zerowaste.db -> /tmp/zerowaste.db
    # sqlite:///./local.db       -> ./local.db
    # sqlite:/tmp/x.db            -> /tmp/x.db
    if url.startswith("sqlite:///"):
        p = url[len("sqlite:///"):]
        if not p.startswith("/"):
            p = "/" + p
        # "sqlite:////tmp/x" gives "//tmp/x" after strip -> collapse to single /
        while p.startswith("//"):
            p = p[1:]
        # Windows drive: "/C:/..." or "/C:\..." -> "C:/..." / "C:\..."
        if len(p) >= 3 and p[0] == "/" and p[1].isalpha() and p[2] == ":":
            p = p[1:]
        return p
    if url.startswith("sqlite:"):
        return url[len("sqlite:"):]
    return "/tmp/zerowaste.db"


def _dict_factory(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description or [])}


class _SqliteCursor:
    """Wraps sqlite3.Cursor translating %s -> ? placeholders."""

    def __init__(self, cursor):
        self._c = cursor

    def execute(self, sql, params=()):
        return self._c.execute(sql.replace("%s", "?"), params or ())

    def executemany(self, sql, rows):
        return self._c.executemany(sql.replace("%s", "?"), rows)

    def fetchone(self):
        return self._c.fetchone()

    def fetchall(self):
        return self._c.fetchall()

    def close(self):
        try:
            self._c.close()
        except Exception:
            pass


class _SqliteConn:
    """Wraps sqlite3.Connection with a psycopg-like execute/cursor surface."""

    def __init__(self, raw):
        self._r = raw

    def execute(self, sql, params=()):
        cur = self._r.execute(sql.replace("%s", "?"), params or ())
        return cur

    def cursor(self):
        return _SqliteCursor(self._r.cursor())

    def commit(self):
        try:
            self._r.commit()
        except Exception:
            pass

    def close(self):
        try:
            self._r.close()
        except Exception:
            pass

_pool_singleton = None

import atexit as _atexit


def _close_pool_at_exit() -> None:
    try:
        reset_pool()
    except Exception:
        pass


_atexit.register(_close_pool_at_exit)


def _pool():
    """Module-level pool (Windows process-spawn makes fresh connects ~65ms;
    pooling also suits Vercel warm invocations). Lazy so import never dials.
    Postgres only — SQLite opens a fresh file connection per call."""
    global _pool_singleton
    if _pool_singleton is None:
        from psycopg_pool import ConnectionPool
        from psycopg.rows import dict_row
        url = config.DATABASE_URL
        if not url:
            raise RuntimeError("DATABASE_URL is not set (see backend/.env.example).")
        if is_sqlite():
            raise RuntimeError("Do not use the Postgres pool for a sqlite DATABASE_URL.")
        _pool_singleton = ConnectionPool(
            url, min_size=1, max_size=10,
            kwargs={"autocommit": True, "row_factory": dict_row},
            open=True,
        )
    return _pool_singleton


def reset_pool() -> None:
    """Tests call this after repointing DATABASE_URL so no stale pool survives."""
    global _pool_singleton
    if _pool_singleton is not None:
        try:
            _pool_singleton.close()
        except Exception:
            pass
    _pool_singleton = None


def _sqlite_connect():
    import sqlite3
    path = _sqlite_path()
    if path != ":memory:":
        parent = os.path.dirname(os.path.abspath(path))
        if parent:
            os.makedirs(parent, exist_ok=True)
    raw = sqlite3.connect(path, timeout=30, check_same_thread=False, isolation_level=None)
    raw.row_factory = _dict_factory
    try:
        raw.execute("PRAGMA journal_mode=WAL")
        raw.execute("PRAGMA busy_timeout=30000")
    except Exception:
        pass
    return _SqliteConn(raw)


def get_conn():
    """Single ported entry point for all DB access (pooled Postgres or file SQLite)."""
    if is_sqlite():
        return _sqlite_connect()
    return _pool().getconn()

def init_db() -> None:
    conn = get_conn()
    schema = SCHEMA_SQL_SQLITE if is_sqlite() else SCHEMA_SQL
    # one statement per execute call: split the schema script
    for stmt in [s.strip() for s in schema.split(";") if s.strip()]:
        conn.execute(stmt)
    # lightweight migration for DBs created before lead_time/moq columns
    if is_sqlite():
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(products)").fetchall()]
    else:
        cols = [r["column_name"] for r in conn.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name='products'").fetchall()]
    if "lead_time_days" not in cols:
        conn.execute("ALTER TABLE products ADD COLUMN lead_time_days INTEGER DEFAULT 2")
    if "moq" not in cols:
        conn.execute("ALTER TABLE products ADD COLUMN moq INTEGER DEFAULT 12")
    release(conn)

def get_meta(key: str, default: str = "") -> str:
    conn = get_conn()
    try:
        r = conn.execute("SELECT value FROM meta WHERE key=%s", (key,)).fetchone()
        return r["value"] if r else default
    finally:
        release(conn)

def set_meta(key: str, value: str) -> None:
    conn = get_conn()
    conn.execute("INSERT INTO meta (key, value) VALUES (%s,%s) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
    release(conn)

def get_asof(default: str = "") -> str:
    """Reset date (as-of) written by seed; falls back to default or today."""
    import datetime as _dt
    fb = default or _dt.date.today().isoformat()
    return get_meta("asof", fb)

def now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()

def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def release(conn) -> None:
    """Return a pooled Postgres connection, or close a SQLite file connection.
    All app code must release instead of close."""
    if is_sqlite():
        try:
            conn.close()
        except Exception:
            pass
        return
    try:
        _pool().putconn(conn)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass

def executemany(sql: str, rows: list) -> None:
    """Batched insert helper (cursor closed, connection released)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.executemany(sql, rows)
        cur.close()
    finally:
        release(conn)

def log_event(source: str, event_type: str, payload: dict) -> None:
    import json
    conn = get_conn()
    conn.execute(
        "INSERT INTO sim_system_events (event_id, created_at, source, event_type, payload_json) VALUES (%s,%s,%s,%s,%s)",
        (new_id("evt_"), now_iso(), source, event_type, json.dumps(payload, default=str)),
    )
    release(conn)

def audit(actor: str, action: str, entity: str, entity_id: str, details: dict) -> None:
    import json
    conn = get_conn()
    conn.execute(
        "INSERT INTO audit_logs (log_id, created_at, actor, action, entity, entity_id, details_json) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (new_id("aud_"), now_iso(), actor, action, entity, entity_id, json.dumps(details, default=str)),
    )
    release(conn)
