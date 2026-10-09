"""Pytest guardrails: tests run ONLY against TEST_DATABASE_URL (a dedicated
Postgres database) and never touch the demo database.

Required environment (do NOT put these in .env files):
  TEST_DATABASE_URL=postgresql://.../zerowaste_test   (local default below)
  AS_OF=2026-10-05                                    (deterministic reset dates)
"""
import os
import sys
import urllib.parse

os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("AS_OF", "2026-10-05")
os.environ.setdefault(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@127.0.0.1:5434/zerowaste_test",
)

from app import config as _config  # noqa: E402  (env must be set before app import)


def _db_name(url: str) -> str:
    return urllib.parse.urlparse(url or "").path.lstrip("/")


def pytest_configure():
    demo = _db_name(_config.DATABASE_URL)
    test = _db_name(_config.TEST_DATABASE_URL)
    assert test, "TEST_DATABASE_URL is not set — refusing to run (would risk the demo DB)."
    assert demo, "DATABASE_URL is not set."
    assert test != demo, (
        f"TEST_DATABASE_URL ({test}) must differ from the demo database ({demo})."
    )
    # fail fast with setup help if Postgres is unreachable
    import psycopg
    try:
        c = psycopg.connect(_config.TEST_DATABASE_URL, connect_timeout=8)
        c.close()
    except Exception as e:
        raise RuntimeError(
            "Cannot reach the Postgres test database at "
            f"{_config.TEST_DATABASE_URL}. Start local Postgres 16+ with databases "
            "'zerowaste', 'zerowaste_test', 'zerowaste_e2e' (see README), "
            f"or set TEST_DATABASE_URL. Cause: {e}"
        )
    # point the whole app at the test database (get_conn reads this live)
    _config.DATABASE_URL = _config.TEST_DATABASE_URL
    from app import database as _db
    _db.reset_pool()
