"""Postgres schema (psycopg3). Supabase/Neon-compatible; no filesystem use.

One connection per call (safe for Vercel serverless), autocommit on so every
statement is durable immediately and no rollback state ever leaks between calls.
"""
from __future__ import annotations
import uuid
from psycopg.rows import dict_row
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
    pooling also suits Vercel warm invocations). Lazy so import never dials."""
    global _pool_singleton
    if _pool_singleton is None:
        from psycopg_pool import ConnectionPool
        url = config.DATABASE_URL
        if not url:
            raise RuntimeError("DATABASE_URL is not set (see backend/.env.example).")
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
        _pool_singleton.close()
    _pool_singleton = None


def get_conn():
    """Single ported entry point for all DB access (pooled)."""
    return _pool().getconn()

def init_db() -> None:
    conn = get_conn()
    # psycopg executes one statement per call: split the schema script
    for stmt in [s.strip() for s in SCHEMA_SQL.split(";") if s.strip()]:
        conn.execute(stmt)
    # lightweight migration for DBs created before lead_time/moq columns
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
    """Return a pooled connection. All app code must release instead of close."""
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
