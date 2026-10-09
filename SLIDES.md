# Hackathon slides — ZeroWaste AI (placeholders must be filled, never invented)
1. Problem: perishable waste + stockouts; variable shelf life; siloed decisions.
2. Solution: 5 deterministic agents + coordinator → exactly one proposed action per SKU/store → planner approves in a decision modal → simulated execution with stock re-check.
3. Architecture: Next.js 16 + R3F frontend → FastAPI agents (SES forecast, FIFO risk, scoring, constraints) → SQLite demo DB (Supabase-ready schema); Gemini explains only. [INSERT ARCH DIAGRAM]
4. Prototype (real captures in docs/screenshots/, taken with Playwright on desktop Chromium):
   - docs/screenshots/01-overview-hero.png — 3D hero orb + live chips (expiring 48h, 7d forecast, pending approvals)
   - docs/screenshots/02-explorer-3d.png — isometric shelves coloured by backend risk
   - docs/screenshots/03-planner-modal.png — decision modal (qty edit within safe bounds, recorded reason)
   - docs/screenshots/04-scenarios.png — 3-policy comparison with mean + min–max
   - docs/screenshots/05-evaluation.png — latest comparison + trade-off note
   - docs/screenshots/06-agents.png — agent status + trace timeline
   [INSERT GITHUB URL]; Live [INSERT DEPLOYED URL] (only if verified accessible).
5. Functionality (measured, seed=42): 5 stores × 18 SKUs × 12 weeks; SES vs 7-day MA vs seasonal-naive on the same held-out 7d with honest winner (SES stays the engine); FIFO risk bands with backend day_offset; markdown guard (never without at-risk units / before-expiry stock-out); markdown 10/20/30/50% (elasticity 1.5), donate (≥1d shelf), transfer (quantified need), replenish (MOQ/lead-time); one open proposal per pair via supersede; rolling-horizon scenarios (re-forecast daily, no look-ahead) sharing identical demand/inventory/seeds; calibration panel (days-of-cover vs 14d horizon).
6. Results (example, 5 seeds): excess_inventory — agentic 505 vs FIFO 3509 waste units (~86% less); supplier_delay — agentic 105 vs FIFO 289 waste units but service only 0.35 (honest trade-off); demand_spike can be unfavourable for agentic on waste (baseline-calibrated ordering into a transient spike; coordinator minimises cost, not waste). Evaluation page carries formulas, period (14-day horizon), units, assumptions, side-by-side costs.
7. Feasibility: synthetic + labelled simulations; 20 backend tests, lint/tsc/build clean, canary bundle scan clean, Playwright E2E across desktop/mobile/full-Chromium/360px with zero console errors; Demo Mode needs no keys; CORS covers localhost + 127.0.0.1; proxy allowlist (unknown → 404, wrong method → 403, prod seed gate).
8. Viability/Scalability: modular agents, schema + APIs support more stores/SKUs/agents; no secrets client-side; decision modal with safe-bound qty edits and audit trail.
