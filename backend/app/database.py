"""PostgreSQL connection management using psycopg 3 and psycopg_pool."""
from contextlib import contextmanager
from typing import Generator, Optional
import psycopg
from psycopg_pool import ConnectionPool
from app.config import get_settings

_pool: Optional[ConnectionPool] = None


def get_pool(database_url: Optional[str] = None) -> ConnectionPool:
    """Initialize or return the global connection pool."""
    global _pool
    if _pool is None:
        url = database_url or get_settings().DATABASE_URL
        # Max 3 connections for serverless / Neon connection limits
        _pool = ConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=3,
            open=True,
            timeout=10.0,
        )
    return _pool


def close_pool() -> None:
    """Close all pooled connections."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_db_connection(database_url: Optional[str] = None) -> Generator[psycopg.Connection, None, None]:
    """Provide a transactional connection from the pool."""
    pool = get_pool(database_url)
    with pool.connection() as conn:
        yield conn


@contextmanager
def get_db_cursor(database_url: Optional[str] = None) -> Generator[psycopg.Cursor, None, None]:
    """Provide a transactional cursor from the pool with automatic commit/rollback."""
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
