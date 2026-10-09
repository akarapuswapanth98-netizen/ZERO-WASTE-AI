# ZeroWaste AI — Agentic Intelligence for Smarter Grocery Inventory
GDGoC HITAM Agentic AI Hackathon — Problem Statement 2: Zero-Waste Grocery.

End-to-end: synthetic seed (42) → forecast → spoilage risk → 5 agents + coordinator → planner approve → simulated execution → scenario evaluation.

## Quickstart
Backend (FastAPI, SQLite zero-config):
```bash
cd zerowaste-ai/backend
pip install -r requirements.txt
python -c "from app.seed import seed_all; print(seed_all(42))"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Frontend (Next.js 16 App Router, `http://localhost:3000` or `http://127.0.0.1:3000` — both in CORS):
```bash
cd ../frontend
npm install
cp .env.example .env.local   # ZEROWASTE_API_BASE=http://127.0.0.1:8000 (server-only)
npm run dev
```
Browser traffic stays same-origin: Next.js `app/api/[...slug]/route.ts` proxies to
FastAPI and attaches `ZEROWASTE_API_KEY` server-side. The proxy forwards only
the 18 route+method pairs the UI uses (unknown → 404, wrong method → 403);
`/api/seed/reset` additionally needs `X-Admin-Token = ADMIN_TOKEN` in production
(open in dev). The key is never in client code — verify with a canary build +
`npm run scan:secrets` (fails if the canary appears in `.next/static`).

## What's implemented vs simulated
- Implemented: SES vs 7-day MA vs seasonal-naive forecasting with held-out MAE/WAPE and honest winner (SES stays the engine model); FIFO spoilage engine with risk bands + day_offset time-travel (`GET /api/risk?day_offset=N`); 5 deterministic agents + coordinator constraints incl. the markdown guard (no markdown without at-risk units or when a stock-out is projected before expiry; guard outcomes shown in "Why this action?"); one open proposal per (store, SKU) — re-runs supersede older undecided rows (kept as `superseded`, hidden from the Planner queue); planner approve/reject/qty-edit/bulk/execute via decision modal (body portal); rolling-horizon scenario sim (re-forecast on history through yesterday with enforced cutoff, daily risk/scoring/coordination, lead times + MOQs, identical demand realisation); scenario calibration endpoint (days-of-cover, horizon, FIFO snapshot); evaluation/audit/CSV; glass UI + 3D hero + realistic 3D store explorer + replay diff.
- Simulated (labelled in UI): ERP/WMS/POS integrations, execution effects, CO2e (2.5 kg/kg assumption), Gemini explanations (template in Demo Mode; key stays server-side via `GEMINI_API_KEY`).

## Data (seed=42 for randomness, dates relative to reset)
5 stores, 18 SKUs, 6 categories (dairy, bakery, produce, meat, seafood, ready-to-eat), 12 weeks daily sales (weekday/payday/weather effects + noise) ending the day before reset, 2–4 batches per store/SKU with imbalances, lead times + MOQs. Reset date = today at reset (`AS_OF` env overrides it for tests); shown as "As of" in the header. Reset: `POST /api/seed/reset?seed=42` (also seeds demo history: full-cover proposals, 1 executed, 1 rejected, 1 scenario set — labelled "seeded demo history").

## Tests
- Backend: `pytest tests/ -v` — 20 passed (M1 workflow incl. auth gate, approve/reject, reproducibility, constraints; supersede + exact-cover; day_offset recompute, past-expiry guard, waste n/a rule, metric-keys/definitions identity, trace-sums conservation, rolling no-look-ahead, markdown guard case, AS_OF override, calibration ratios, audit objects/counts, scenario overrides, seeded history, auto-seed).
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build` — all clean.
- E2E: `npx playwright test` — serial (`workers: 1`, one shared DB, backend `AS_OF=2026-10-05`) across desktop, mobile, full-Chromium and 360px projects: UI seed → run agents → modal approve + reject → execute → reject-400 → supersede uniqueness → scenario reproducibility → evaluation/audit → reload persistence → 3D + backend time-travel → draw-call budget (≤200, desktop) → fallbacks → proxy allow/block contract → "As of" header. Zero console errors on all 9 routes. Screenshots: `npx playwright test --project=desktop e2e/shots.spec.ts` → `docs/screenshots/`.
- Docs: `docs/DEPLOY.md` (Render + Vercel, SQLite disk vs Postgres port note), `docs/DEMO_SCRIPT.md` (2-minute journey), screenshots referenced from `SLIDES.md`.

## Scenario honesty rules
- Waste-reduction % shows `n/a (baseline waste ~ 0)` when FIFO mean waste < 10 units; absolutes always beside it.
- Results are mixed and shown as-is, e.g. excess_inventory ≈ −86% waste (agentic better), demand_spike can be unfavourable for agentic on waste (baseline-calibrated ordering into a transient spike; verified with a day-by-day trace in `backend/scripts/trace_spike.py`) while winning on net margin, supplier_delay hurts every policy on service. Runtime excluded from reproducibility checks.
- Accounting (see Evaluation page): revenue is gross (pre-markdown); COGS = sold × unit cost; ordering fees = fixed order fees + transfer costs (purchase of ordered units tracked separately as `purchase_cost`); total_cost = fees + waste + markdown − donation recovery; net_margin = revenue − COGS − waste − markdown − fees. Stockout "fewer/more" claims in notes require a material gap (≥10 units and ≥2%).

## Deployment
- Frontend → Vercel (`frontend/vercel.json`); set server-only `ZEROWASTE_API_BASE` to the backend URL (+ `ZEROWASTE_API_KEY`, `ADMIN_TOKEN` as needed). No `NEXT_PUBLIC_API_*` exists by design.
- Backend → Render (`backend/render.yaml`): `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, persistent disk for `DATABASE_PATH` (auto-seeds when empty).
- No live URLs claimed — deploy, verify, then replace `[INSERT DEPLOYED URL]`.
