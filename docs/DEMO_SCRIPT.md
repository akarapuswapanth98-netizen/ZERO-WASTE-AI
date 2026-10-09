# 2-minute demo script — ZeroWaste AI (follow the real app, ~120s)

Setup before the call: backend `:8000` + frontend `:3000` running, page open on Overview.

## 0:00–0:15 — Hook (Overview hero)
"ZeroWaste AI cuts grocery waste with five deterministic agents plus a coordinator.
Everything you see is computed live from synthetic seed-42 data — nothing is mocked.
Three chips up top: units expiring in 48 hours, 7-day forecast for our top SKUs,
pending planner approvals."

## 0:15–0:35 — Seed + run agents
Click **Seed demo** (toast: 18 SKUs, 5 stores), then **Run agents**.
"Each run writes one proposal per store and SKU. Re-runs supersede older open
proposals — the queue never shows stale duplicates."

## 0:35–0:55 — Planner approve + reject
Open **Planner**. "Every action needs a human." Click **Why this action?** —
every scored option with expected loss. **Approve** one (optional qty edit within
safe bounds), **Reject** another. "Rejected proposals can never execute —
the API refuses with 400. Approved ones execute only inside the simulation,
and if stock moved, they visibly fail instead of pretending success."
Execute the approved one.

## 0:55–1:20 — 3D explorer + time travel
Open **Shelves 3D**. "Colour is backend spoilage risk, not decoration."
Drag the **time-travel slider to +3**: risk is recomputed server-side with the
same FIFO engine — watch statuses flip. Click a red item for batches, forecast,
risk range, and the recommended action.

## 1:20–1:45 — Scenarios (honest numbers)
Open **Scenarios**, run **demand_spike**. "All three policies get identical
demand, inventory and seeds. Sometimes agentic loses on waste — ordering into
a transient spike backfires — and we show that. The coordinator minimises
expected cost, not waste units."

## 1:45–2:00 — Evaluation + close
Open **Evaluation**: side-by-side waste, stockouts, service, total cost plus the
plain-language trade-off note, with formulas and assumptions on the page.
Close: "Deterministic engine, human approval gate, reproducible evaluation —
and every limitation is labelled in the UI."

## If something breaks live
Fall back to these true statements: seed is one click and deterministic;
`pytest tests/` (9 passed) and `npx playwright test` (6 passed × desktop/mobile)
are the receipts; unfavourable scenario results are a feature of honest
evaluation, not a demo failure.
