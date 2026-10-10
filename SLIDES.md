# Hackathon slides — ZeroWaste AI (placeholders must be filled, never invented)
1. Problem: perishable waste + stockouts; variable shelf life; siloed decisions.
2. Solution: 5 deterministic agents + coordinator → exactly one proposed action per SKU/store → planner approves in a decision modal → simulated execution with stock re-check.
3. Architecture: Next.js 16 + R3F frontend → FastAPI agents (per-series best-of-3 forecast, FIFO risk, scoring, constraints) → Postgres demo DB; Gemini explains only. [INSERT ARCH DIAGRAM]
4. Prototype (real captures in docs/screenshots/, taken with Playwright on desktop Chromium):
   - docs/screenshots/01-overview-hero.png — cutaway shelf hero + live chips (expiring 48h, 7d forecast, pending approvals)
   - docs/screenshots/02-explorer-3d.png — isometric shelves coloured by backend risk
   - docs/screenshots/03-planner-modal.png — decision modal (qty edit within safe bounds, recorded reason)
   - docs/screenshots/04-scenarios.png — 3-policy comparison with mean + min–max
   - docs/screenshots/05-evaluation.png — latest comparison + trade-off note
   - docs/screenshots/06-agents.png — agent status + trace timeline
   [INSERT GITHUB URL]; Live [INSERT DEPLOYED URL] (only if verified accessible).
5. Functionality (measured, seed=42): 5 stores × 18 SKUs × 12 weeks; per-series best of seasonal-naive, moving average and SES on the same held-out 7d with honest winner (winner counts: seasonal-naive 56, SES 18, 7-day MA 16 of 90 series); FIFO risk bands with backend day_offset; markdown guard (never without at-risk units / before-expiry stock-out); markdown 10/20/30/50% (elasticity 1.5), donate (≥1d shelf), transfer (quantified need), replenish (MOQ/lead-time); one open proposal per pair via supersede; rolling-horizon scenarios (re-forecast daily, no look-ahead) sharing identical demand/inventory/seeds; calibration panel (days-of-cover vs 14d horizon).
6. Results (5 seeds, synthetic data — waste units / stockouts / service / net margin, agentic vs FIFO vs fixed-threshold):
   - baseline: 499 / 1092 / 0.93 / $18,475 vs 291 / 9143 / 0.37 / $6,438 vs 2390 / 177 / 0.99 / $15,894.
   - demand_spike: 369 / 1881 / 0.90 / $23,198 vs 13 / 12396 / 0.32 / $7,089 vs 1230 / 22 / 1.00 / $23,508. Agentic loses on waste and trails fixed-threshold on margin and service here.
   - excess_inventory: 769 / 833 / 0.94 / $18,309 vs 9858 / 8038 / 0.45 / −$2,805 vs 11215 / 584 / 0.96 / $6,328.
   - supplier_delay: 215 / 2196 / 0.85 / $17,096 vs 291 / 9143 / 0.37 / $6,438 vs 1447 / 2022 / 0.86 / $14,548. Service essentially tied with fixed-threshold.
   Action mix across the 90 proposals: replenish 57, donate 14, no-action 18, transfer 1, markdown 0 — markdown is built and scored but the guard fires it rarely. Evaluation page carries formulas, period (14-day horizon), units, assumptions, side-by-side costs.
7. Feasibility: synthetic + labelled simulations; 20 backend tests, lint/tsc/build clean, canary bundle scan clean, Playwright E2E across desktop/mobile/full-Chromium/360px with zero console errors; Demo Mode needs no keys; CORS covers localhost + 127.0.0.1; proxy allowlist (unknown → 404, wrong method → 403, prod seed gate).
8. Viability/Scalability: modular agents, schema + APIs support more stores/SKUs/agents; no secrets client-side; decision modal with safe-bound qty edits and audit trail.
