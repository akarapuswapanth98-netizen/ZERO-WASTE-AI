"""Tests for fail-closed authentication and database safety guards."""
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import app
from tests.conftest import verify_test_database_safety


def test_database_safety_guard_refuses_demo_and_prod():
    """Verify that verify_test_database_safety refuses demo, dev, or production databases."""
    with pytest.raises(AssertionError):
        verify_test_database_safety("postgresql://user@localhost/zerowaste_dev")

    with pytest.raises(AssertionError):
        verify_test_database_safety("postgresql://user@localhost/zerowaste_demo")

    with pytest.raises(AssertionError):
        verify_test_database_safety("postgresql://user@localhost/production_db")

    # Only zerowaste_test passes
    verify_test_database_safety("postgresql://user@localhost/zerowaste_test")


def test_fail_closed_refuses_unset_api_key_when_demo_mode_false():
    """Verify backend refuses to start if DEMO_MODE=False and API_KEY is unset."""
    with pytest.raises(RuntimeError) as exc_info:
        Settings(DATABASE_URL="postgresql://localhost/zerowaste_test", DEMO_MODE=False, API_KEY=None)
    assert "FAIL-CLOSED SECURITY" in str(exc_info.value)


def test_fail_closed_refuses_known_default_api_keys():
    """Verify backend refuses known default/placeholder API keys."""
    for bad_key in ["", "changeme", "secret", "default", "123456"]:
        with pytest.raises(RuntimeError):
            Settings(DATABASE_URL="postgresql://localhost/zerowaste_test", DEMO_MODE=False, API_KEY=bad_key)


def test_fail_closed_refuses_demo_mode_in_production():
    """Verify backend refuses DEMO_MODE=True if PRODUCTION=1 or VERCEL is set."""
    with pytest.raises(RuntimeError) as exc_info:
        Settings(
            DATABASE_URL="postgresql://localhost/zerowaste_test",
            DEMO_MODE=True,
            PRODUCTION="1",
        )
    assert "DEMO_MODE cannot be enabled when PRODUCTION=1 or VERCEL is set" in str(exc_info.value)

    with pytest.raises(RuntimeError):
        Settings(
            DATABASE_URL="postgresql://localhost/zerowaste_test",
            DEMO_MODE=True,
            VERCEL="1",
        )


def test_health_endpoint_is_public():
    """GET /api/health must be accessible without API key."""
    with TestClient(app) as unauthed_client:
        res = unauthed_client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["service"] == "zerowaste-ai-backend"
        assert "database_connected" in data


def test_protected_endpoints_refuse_unauthenticated_requests():
    """Protected endpoints return 401 if API key is missing or invalid."""
    with TestClient(app) as unauthed_client:
        res = unauthed_client.get("/api/inventory")
        assert res.status_code == 401
        assert "Unauthorized" in res.json()["detail"]

        res_bad_key = unauthed_client.get("/api/inventory", headers={"X-API-Key": "wrong_key"})
        assert res_bad_key.status_code == 401


def test_admin_endpoints_require_admin_token(client):
    """Admin endpoints reject requests missing X-Admin-Token with 403 Forbidden."""
    res = client.post("/api/admin/reset")
    assert res.status_code == 403

    res_bad = client.post("/api/admin/reset", headers={"X-Admin-Token": "wrong_admin_token"})
    assert res_bad.status_code == 403
