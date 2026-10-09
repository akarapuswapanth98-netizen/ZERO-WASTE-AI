"""Central config: env-driven, Demo Mode default, no secrets in code.

Database is Postgres via DATABASE_URL (Supabase/Neon pooled URL in production,
local server for dev/tests). Tests MUST use TEST_DATABASE_URL (a different
database); see backend/tests/conftest.py which enforces this.
"""
from __future__ import annotations
import os
from dotenv import load_dotenv

load_dotenv()

DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
API_KEY = os.getenv("API_KEY", "demo-key-123")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5434/zerowaste")
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5434/zerowaste_test")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Comma-separated browser origins. Never "*" — the proxy/keys must not be callable
# from arbitrary sites. Local dev needs both localhost and 127.0.0.1 forms.
_front = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS = [o.strip() for o in _front.split(",") if o.strip()]
assert all(o != "*" for o in CORS_ORIGINS), "FRONTEND_ORIGIN must never be '*'"

PRODUCTION = os.getenv("PRODUCTION", "0") == "1"
SEED = 42
AUTO_SEED = os.getenv("AUTO_SEED", "true").lower() == "true"
