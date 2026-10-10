"""Auth boot gates: the app fails closed unless explicitly demo or properly keyed.

Subprocess tests prove import-time refusal with a clean environment (no ambient
DEMO_MODE/API_KEY leaking in). The 401/200 test monkeypatches config live.
"""
import os
import subprocess
import sys

_BACKEND = os.path.join(os.path.dirname(__file__), "..")
_SCRUB = ("DEMO_MODE", "API_KEY", "PRODUCTION", "VERCEL",
          "DATABASE_URL", "TEST_DATABASE_URL", "AS_OF")


def _boot(env_extra):
    env = {k: v for k, v in os.environ.items() if k not in _SCRUB}
    env.update(env_extra)
    return subprocess.run(
        [sys.executable, "-c", "from app.main import app"],
        cwd=_BACKEND, env=env, capture_output=True, text=True, timeout=180,
    )


def test_boot_refused_without_key():
    r = _boot({"DEMO_MODE": "false"})
    assert r.returncode != 0, "booted with DEMO_MODE=false and no API_KEY"
    assert "API_KEY" in r.stderr


def test_boot_refused_with_default_key():
    r = _boot({"DEMO_MODE": "false", "API_KEY": "demo-key-123"})
    assert r.returncode != 0, "booted with the public default key"
    assert "demo-key-123" in r.stderr


def test_boot_refused_demo_in_production():
    r = _boot({"PRODUCTION": "1", "DEMO_MODE": "true"})
    assert r.returncode != 0, "booted with DEMO_MODE=true under PRODUCTION=1"
    assert "DEMO_MODE" in r.stderr


def test_boot_refused_demo_on_vercel():
    r = _boot({"VERCEL": "1", "DEMO_MODE": "true"})
    assert r.returncode != 0, "booted with DEMO_MODE=true on Vercel"
    assert "DEMO_MODE" in r.stderr


def test_boot_ok_explicit_demo():
    r = _boot({"DEMO_MODE": "true"})
    assert r.returncode == 0, r.stderr[-800:]


def test_401_without_key_200_with_key():
    from fastapi.testclient import TestClient
    from app.main import app
    from app import config
    old_demo, old_key = config.DEMO_MODE, config.API_KEY
    config.DEMO_MODE, config.API_KEY = False, "test-key-abc-123"
    try:
        c = TestClient(app)
        assert c.get("/api/stores").status_code == 401
        assert c.get("/api/stores", headers={"X-API-Key": "wrong"}).status_code == 401
        ok = c.get("/api/stores", headers={"X-API-Key": "test-key-abc-123"})
        assert ok.status_code == 200
    finally:
        config.DEMO_MODE, config.API_KEY = old_demo, old_key
