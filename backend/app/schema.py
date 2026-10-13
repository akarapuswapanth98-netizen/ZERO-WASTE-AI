"""Idempotent schema application module."""
import os
from pathlib import Path
from typing import Optional
from app.database import get_db_cursor

SCHEMA_SQL_PATH = Path(__file__).parent / "schema.sql"


def apply_schema(database_url: Optional[str] = None) -> None:
    """Read and apply schema.sql idempotently."""
    sql_content = SCHEMA_SQL_PATH.read_text(encoding="utf-8")
    with get_db_cursor(database_url) as cur:
        cur.execute(sql_content)


def reset_schema(database_url: Optional[str] = None) -> None:
    """Drop all tables and recreate schema. Caution: for reset/test suites only."""
    tables = [
        "planner_decisions",
        "recommendations",
        "agent_runs",
        "inventory_batches",
        "sales_history",
        "products",
        "stores",
        "sim_system_events",
        "scenario_runs",
        "audit_logs",
    ]
    with get_db_cursor(database_url) as cur:
        for t in tables:
            cur.execute(f"DROP TABLE IF EXISTS {t} CASCADE;")
    apply_schema(database_url)
