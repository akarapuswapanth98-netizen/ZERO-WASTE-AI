"""Pytest configuration and test isolation fixtures for ZeroWaste AI."""
import os
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from urllib.parse import urlparse

# Ensure test runs against zerowaste_test ONLY
TEST_DB_URL = "postgresql://postgres@localhost:5433/zerowaste_test"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["API_KEY"] = "test_secret_key_8f7b"
os.environ["ADMIN_TOKEN"] = "test_admin_token_4c2d"
os.environ["DEMO_MODE"] = "False"
os.environ["AS_OF_DATE"] = "2026-10-12"

# Remove production flags if set in local env
os.environ.pop("PRODUCTION", None)
os.environ.pop("VERCEL", None)

from app.config import get_settings, reset_settings_cache
from app.database import close_pool, get_pool
from app.main import app
from app.schema import reset_schema
from app.seed import seed_database


def verify_test_database_safety(db_url: str) -> None:
    """Enforce strict rule: Test suite refuses to run if pointed at demo, dev, or production DB."""
    parsed = urlparse(db_url)
    db_name = parsed.path.lstrip("/")
    
    assert db_name == "zerowaste_test", (
        f"CRITICAL SAFETY VIOLATION: Test suite attempted to run against database '{db_name}'. "
        "Tests must run ONLY against 'zerowaste_test'."
    )
    
    forbidden = ["demo", "prod", "zerowaste_dev", "production"]
    for word in forbidden:
        assert word not in db_name.lower(), (
            f"CRITICAL SAFETY VIOLATION: Database name '{db_name}' contains forbidden pattern '{word}'."
        )


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Verify test safety, initialize schema, and seed test database once for the session."""
    reset_settings_cache()
    settings = get_settings()
    verify_test_database_safety(settings.DATABASE_URL)

    # Initialize connection pool and seed test db
    close_pool()
    get_pool(TEST_DB_URL)
    reset_schema(TEST_DB_URL)
    seed_database(database_url=TEST_DB_URL, seed=42, force_reset=True)

    yield

    close_pool()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """TestClient configured with valid test API key."""
    with TestClient(app) as test_client:
        test_client.headers.update({"X-API-Key": "test_secret_key_8f7b"})
        yield test_client


@pytest.fixture
def admin_client() -> Generator[TestClient, None, None]:
    """TestClient configured with valid test API key and Admin token."""
    with TestClient(app) as test_client:
        test_client.headers.update({
            "X-API-Key": "test_secret_key_8f7b",
            "X-Admin-Token": "test_admin_token_4c2d",
        })
        yield test_client
