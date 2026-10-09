# Deploy — ZeroWaste AI (exact steps, no live URL claimed)

## Backend → Vercel (FastAPI + Postgres)

Per [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python)
and [FastAPI](https://vercel.com/docs/frameworks/backend/fastapi) docs (checked
2026-10-10): Vercel detects FastAPI from `requirements.txt` and loads the `app`
object from a supported entrypoint. Ours is `app/main.py` (inside `backend/`),
so it works zero-config; `backend/vercel.json` pins `app/main.py` with
`maxDuration: 60` and excludes `tests/**` from the bundle. Lifespan events are
supported. No filesystem writes happen anywhere in the app.

1. Push `zerowaste-ai/` to GitHub. Create a Postgres database (Neon, Supabase,
   or any pooled Postgres) with three databases: `zerowaste`, `zerowaste_test`,
   `zerowaste_e2e`.
2. Vercel → Add New → Project → import the repo.
   - Root Directory: `zerowaste-ai/backend`
   - Framework preset: FastAPI (auto via `requirements.txt`).
3. Environment variables (Vercel → Settings → Environment Variables, Production):
   - `DATABASE_URL=postgresql://.../zerowaste` (use the pooled connection string)
   - `DEMO_MODE=true`
   - `API_KEY=<generate, e.g. openssl rand -hex 24>` (required only if you later set `DEMO_MODE=false`)
   - `FRONTEND_ORIGIN=https://<your-frontend>.vercel.app` (comma-separated list allowed; never `*`)
   - `PRODUCTION=1` (caps scenario seeds at 5 so runs finish inside the function timeout)
   - `AUTO_SEED=true` (default; cold start creates schema + fast core seed only — no agent runs, fits function limits; full demo history comes from one explicit reset call)
   - `GEMINI_API_KEY=` (leave empty for template explanations)
4. Cold-start behavior: first request creates tables and, if `stores` is empty,
   runs the fast core seed (seed=42, batched inserts, <2s). Then call
   `POST /api/seed/reset` once (with `X-Admin-Token` if you set `ADMIN_TOKEN`
   on the frontend proxy... note: the backend reset endpoint itself needs no
   token in DEMO_MODE; the frontend proxy gates it) to build full demo history.
5. Verify: open `https://<your-backend>.vercel.app/api/health`
   (expect `{"status":"ok","demo_mode":true,...}`) and `/docs` (OpenAPI).

## Backend → Render (alternative)

1. Root Directory: `zerowaste-ai/backend`. Environment: Python 3.13.
   Build: `pip install -r requirements.txt`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
2. Same env vars as above, with `DATABASE_URL` pointing at Render Postgres
   (or any external Postgres). No disk needed — Postgres is the persistence.
   (The old SQLite disk option is retired with the Postgres port.)

## Frontend → Vercel (Next.js 16)

1. Vercel → Add New → Project → import the repo.
   - Root Directory: `zerowaste-ai/frontend`
   - Framework preset: Next.js (auto). Build: `npm run build` (`vercel.json` present).
2. Environment variables (Vercel → Settings → Environment Variables, Production).
   These are SERVER-ONLY (no `NEXT_PUBLIC_` prefix) — the browser talks to
   Next.js route handlers (`app/api/[...slug]`), which attach the key server-side:
   - `ZEROWASTE_API_BASE=https://<your-backend>.vercel.app`
   - `ZEROWASTE_API_KEY=` (empty is fine while backend `DEMO_MODE=true`;
     set both sides consistently if you enable API-key auth)
   - `ADMIN_TOKEN=<generate, e.g. openssl rand -hex 24>` — required to call
     the proxied `POST /api/seed/reset` in production (send as `X-Admin-Token`).
     Without it the Seed demo button returns 403 in production; this is
     intentional (verified: no token → 403, wrong token → 403, correct → 200).
   There is deliberately no `NEXT_PUBLIC_API_*` variable: `npm run scan:secrets`
   (after a canary build) fails the deploy if a key ever lands in `.next/static`.
3. Deploy → open the production URL → Overview should load live stats.
   If it shows "Backend unreachable", the API URL/FRONTEND_ORIGIN values are wrong.
4. Screenshots for the deck: run `npx playwright test --project=desktop e2e/shots.spec.ts`
   locally (needs both servers up — the Playwright `webServer` block starts them),
   outputs land in `docs/screenshots/`.

## Local Postgres (dev/tests)

No system Postgres is required: `pip install postgresql-binaries` provides
server binaries with no admin install. Then:

```powershell
$pgbin = python -c "from postgresql_binaries import bin; print(bin())"
& "$pgbin\initdb.exe" -D $env:TEMP\pgdata -U postgres --auth=trust -E UTF8
"port=5434" | Add-Content $env:TEMP\pgdata\postgresql.conf
"listen_addresses='127.0.0.1'" | Add-Content $env:TEMP\pgdata\postgresql.conf
& "$pgbin\pg_ctl.exe" -D $env:TEMP\pgdata -l $env:TEMP\pgdata.log start
```

create databases `zerowaste`, `zerowaste_test`, `zerowaste_e2e`, and either export
`DATABASE_URL` / `TEST_DATABASE_URL` / `E2E_DATABASE_URL` or rely on the
`postgresql://postgres:postgres@127.0.0.1:5434/<db>` defaults. Prefer a real
system Postgres 16+ for daily use; the pip binaries are a zero-install fallback
(the 5433 data dir in this repo hit a Windows shared-memory crash loop, while a
fresh cluster on 5434 is healthy — if your server wedges, re-initdb somewhere new).

## Status

Not deployed as of 2026-10-10. No live URL is claimed. After deploying, replace
`[INSERT DEPLOYED URL]` in SLIDES.md only with a URL you opened and clicked through.
