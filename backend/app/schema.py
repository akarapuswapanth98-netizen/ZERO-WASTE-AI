"""Idempotent schema application module supporting PostgreSQL and SQLite."""
from pathlib import Path
from typing import Optional
from app.database import get_db_cursor, is_sqlite

SCHEMA_SQL_PATH = Path(__file__).parent / "schema.sql"
SCHEMA_SQLITE_PATH = Path(__file__).parent / "schema_sqlite.sql"


def apply_schema(database_url: Optional[str] = None) -> None:
    """Read and apply schema idempotently."""
    is_sql = is_sqlite(database_url)
    path = SCHEMA_SQLITE_PATH if is_sql else SCHEMA_SQL_PATH
    sql_content = path.read_text(encoding="utf-8")
    with get_db_cursor(database_url) as cur:
        if is_sql:
            for stmt in sql_content.split(";"):
                stmt = stmt.strip()
                if stmt:
                    cur.execute(stmt)
        else:
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
    is_sql = is_sqlite(database_url)
    with get_db_cursor(database_url) as cur:
        for t in tables:
            if is_sql:
                cur.execute(f"DROP TABLE IF EXISTS {t};")
            else:
                cur.execute(f"DROP TABLE IF EXISTS {t} CASCADE;")
    apply_schema(database_url)
