"""Central config: env-driven, fail-closed auth, no secrets in code.

Demo mode is opt-in (DEMO_MODE=true, local only). Anything else requires a
real API_KEY; production/VERCEL + DEMO_MODE=true refuses to start.
Database is Postgres via DATABASE_URL, with a zero-setup SQLite fallback:
DATABASE_URL=sqlite:////tmp/zerowaste.db (or, on Vercel, an unset/localhost
URL auto-falls-back to that path — see app/database._effective_url).
Tests MUST use TEST_DATABASE_URL; see backend/tests/conftest.py.
"""
from __future__ import annotations
import os
from dotenv import load_dotenv

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
API_KEY = os.getenv("API_KEY", "")
PRODUCTION = os.getenv("PRODUCTION", "0") == "1"
_ON_VERCEL = bool(os.getenv("VERCEL"))

DEFAULT_API_KEY = "demo-key-123"
if (PRODUCTION or _ON_VERCEL) and DEMO_MODE:
    raise RuntimeError(
        "Refusing to start: DEMO_MODE=true is not allowed when PRODUCTION=1 "
        "or running on Vercel. Set DEMO_MODE=false (and a real API_KEY)."
    )
if not DEMO_MODE and (not API_KEY or API_KEY == DEFAULT_API_KEY):
    raise RuntimeError(
        "Refusing to start: set a real API_KEY environment variable when "
        "DEMO_MODE is false; the default 'demo-key-123' is public. "
        "Local demos opt in with DEMO_MODE=true."
    )
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5434/zerowaste")
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5434/zerowaste_test")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Comma-separated browser origins. Never "*" — the proxy/keys must not be callable
# from arbitrary sites. Local dev needs both localhost and 127.0.0.1 forms.
_front = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS = [o.strip() for o in _front.split(",") if o.strip()]
assert all(o != "*" for o in CORS_ORIGINS), "FRONTEND_ORIGIN must never be '*'"

SEED = 42
AUTO_SEED = os.getenv("AUTO_SEED", "true").lower() == "true"
