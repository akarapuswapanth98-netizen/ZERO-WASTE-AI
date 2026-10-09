"""Phase-1 regression tests: backend time-travel risk, waste n/a note, seeded demo history."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("AS_OF", "2026-10-05")  # deterministic reset dates; override to test relative seeding
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_risk_day_offset_past_expiry_no_crash():
    client.post("/api/seed/reset", params={"seed": 42})
    # CROIS-4PK near batch expires in 1 day; +7 projects past all expiries for some stores
    r = client.get("/api/risk", params={"store_id": "store_002", "sku": "CROIS-4PK", "day_offset": 7})
    assert r.status_code == 200
    body = r.json()
    assert body["effective_date"] == "2026-10-12" and body["band"] in ("Low", "Medium", "High")

def test_risk_day_offset_recomputes():
    client.post("/api/seed/reset", params={"seed": 42})
    r0 = client.get("/api/risk", params={"store_id": "store_001", "sku": "BREAD-WH"}).json()
    r3 = client.get("/api/risk", params={"store_id": "store_001", "sku": "BREAD-WH", "day_offset": 3}).json()
    assert r3["day_offset"] == 3 and r3["effective_date"] == "2026-10-08"
    # same engine, later date -> at-risk cannot decrease
    assert r3["at_risk_mean"] >= r0["at_risk_mean"]

def test_waste_reduction_na_when_baseline_zero():
    from app.scenarios import waste_reduction_summary, WASTE_PCT_FLOOR
    # deterministic unit check of the floor rule (both branches)
    pct, note = waste_reduction_summary(3.0, 0.0, 3)
    assert pct is None and "n/a" in note and "agentic 0.0 vs FIFO 3.0" in note
    pct2, note2 = waste_reduction_summary(100.0, 60.0, 5)
    assert pct2 == 40.0 and "Agentic 60.0 vs FIFO 100.0" in note2
    # live contract: note always carries absolutes; pct None iff baseline < floor
    client.post("/api/seed/reset", params={"seed": 42})
    out = client.post("/api/scenarios/run",
                      json={"preset": "demand_spike", "seeds": 3, "base_seed": 7}).json()
    wf = out["policies"]["fifo"]["waste_units"]["mean"]
    wa = out["policies"]["agentic"]["waste_units"]["mean"]
    assert f"agentic {wa} vs FIFO {wf}" in out["waste_reduction_note"] or \
           f"Agentic {wa} vs FIFO {wf}" in out["waste_reduction_note"]
    if wf < WASTE_PCT_FLOOR:
        assert out["waste_reduction_pct"] is None
    else:
        assert isinstance(out["waste_reduction_pct"], (int, float))

def test_scenario_overrides_applied():
    client.post("/api/seed/reset", params={"seed": 42})
    out = client.post("/api/scenarios/run", json={"preset": "demand_spike", "seeds": 2, "base_seed": 42,
                                                  "overrides": {"demand_mult": 2.0}}).json()
    assert out["params"]["demand_mult"] == 2.0 and out["params"].get("_custom") is True

def test_audit_returns_objects_and_counts():
    client.post("/api/seed/reset", params={"seed": 42})
    a = client.get("/api/audit").json()
    assert len(a["audit_logs"]) > 0 and isinstance(a["audit_logs"][0]["details"], dict)
    assert len(a["system_events"]) > 0 and isinstance(a["system_events"][0]["payload"], dict)
    total_runs = sum(c["n"] for c in a["agent_counts"])
    assert total_runs > 0
    # COUNT(*) agreement (not a capped fetch)
    from app import database as db
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) c FROM agent_runs").fetchone()["c"]
    conn.close()
    assert total_runs == n

def test_autoseed_on_empty_db():
    from app import database as db, config
    assert config.AUTO_SEED is True
    conn = db.get_conn()
    conn.execute("DELETE FROM stores")
    conn.commit()
    conn.close()
    with TestClient(app):
        pass
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) c FROM stores").fetchone()["c"]
    conn.close()
    assert n == 5

def test_calibration_excess_is_waste_dominated_and_baseline_service():
    # excess_inventory x3.5: FIFO drowns in waste and ends holding surplus (long-shelf),
    # far above baseline; a reordering policy reaches >= 0.9 service on baseline.
    client.post("/api/seed/reset", params={"seed": 42})
    ex = client.post("/api/scenarios/run", json={"preset": "excess_inventory", "seeds": 2, "base_seed": 42}).json()
    base = client.post("/api/scenarios/run", json={"preset": "baseline", "seeds": 2, "base_seed": 42}).json()
    ex_f, base_f = ex["policies"]["fifo"], base["policies"]["fifo"]
    assert ex_f["waste_units"]["mean"] > 10 * base_f["waste_units"]["mean"]
    assert ex_f["ending_onhand"]["mean"] > 2 * base_f["ending_onhand"]["mean"]
    assert base["policies"]["fixed-threshold"]["service_level"]["mean"] >= 0.9

def test_asof_override_shifts_reset_dates():
    import os
    os.environ["AS_OF"] = "2026-01-15"
    try:
        out = client.post("/api/seed/reset", params={"seed": 42}).json()
    finally:
        os.environ["AS_OF"] = "2026-10-05"
    assert out["asof"] == "2026-01-15"
    h = client.get("/api/health").json()
    assert h["asof"] == "2026-01-15"
    client.post("/api/seed/reset", params={"seed": 42})  # restore canonical fixture

def test_markdown_guard_blocks_no_risk_stockout_case():
    # store_005 VEG-BIRY: ~0 at risk, forecast >> stock -> replenish, not markdown
    client.post("/api/seed/reset", params={"seed": 42})
    r = client.post("/api/agents/run", json={"store_id": "store_005", "sku": "VEG-BIRY"}).json()
    rec_id = r["results"][0]["rec_id"]
    d = client.get(f"/api/recommendations/{rec_id}").json()
    assert d["action_type"] != "markdown"
    guards = [o for o in d["alternatives"] if o.get("feasible") is False]
    assert any(g["action"] == "markdown" and "guarded" in (g.get("reason") or "") for g in guards)

def test_fresh_reset_has_exactly_one_open_proposal_per_pair():
    client.post("/api/seed/reset", params={"seed": 42})
    proposed = client.get("/api/recommendations", params={"status": "proposed"}).json()["recommendations"]
    pairs = sorted(f"{r['store_id']}|{r['sku']}" for r in proposed)
    assert len(pairs) == 5 * 18, f"expected full cover, got {len(pairs)}"
    assert len(set(pairs)) == len(pairs), "duplicate open proposals for one pair"

def test_stored_scenario_rows_share_keys_and_definitions():
    client.post("/api/seed/reset", params={"seed": 42})
    ev = client.get("/api/evaluation").json()
    rows = ev["scenario_runs"]
    assert len(rows) >= 3  # agentic + fifo + fixed-threshold from seeded history
    expected = {"waste_units", "waste_cost", "stockout_units", "order_cost", "purchase_cost",
                "cogs", "markdown_cost", "donated_units", "donation_recovery", "total_cost",
                "net_margin", "ending_onhand", "revenue", "sales_units", "service_level", "runtime_ms"}
    for r in rows:
        assert set(r["metrics"].keys()) == expected, f"key drift in {r['scenario_id']}"
    # definitions identity on a live run: margin/cost recomputed from components
    live = client.post("/api/scenarios/run", json={"preset": "short_shelf", "seeds": 2, "base_seed": 9}).json()
    for pol, agg in live["policies"].items():
        g = lambda k: agg[k]["mean"]
        assert abs(g("net_margin") - (g("revenue") - g("cogs") - g("waste_cost") - g("markdown_cost") - g("order_cost"))) < 0.1, pol
        assert abs(g("total_cost") - (g("order_cost") + g("waste_cost") + g("markdown_cost") - g("donation_recovery"))) < 0.1, pol

def test_no_lookahead_in_rolling_plans():
    # Same cutoff, divergent futures -> identical plans: the planner cannot see tomorrow.
    from datetime import date as _d, timedelta as _td
    from app import scenarios as sc
    from app import database as db
    client.post("/api/seed/reset", params={"seed": 42})
    prods, batches, sales = sc._snapshot()
    store_ids = sorted({b["store_id"] for b in batches})
    asof = db.get_asof()
    cutoff = (_d.fromisoformat(asof) - _td(days=1)).isoformat()
    hist_a = {k: [(d, u) for d, u in v if d <= cutoff] for k, v in sales.items()}
    hist_b = {}
    for k, v in hist_a.items():
        hist_b[k] = list(v) + [(asof, 9999), (asof, 9999)]  # fabricated future spike, B only
    pa = sc._pure_plan(prods, batches, hist_a, store_ids, asof)
    pb = sc._pure_plan(prods, batches, hist_b, store_ids, asof)
    assert pa == pb

def test_trace_sums_match_totals():
    from app import scenarios as sc
    client.post("/api/seed/reset", params={"seed": 42})
    for pol in ("agentic", "fifo", "fixed-threshold"):
        days: list = []
        m = sc._sim_one_policy(pol, "demand_spike", dict(sc.PRESETS["demand_spike"]), 42, collect=days)
        assert len(days) == 14
        assert sum(d["sales"] for d in days) == m["sales_units"]
        assert sum(d["stockout"] for d in days) == m["stockout_units"]
        assert sum(d["expired"] for d in days) == m["waste_units"]
        # conservation per day: everything demanded is sold or stocked out
        for d in days:
            assert d["sales"] + d["stockout"] == d["demand_base"] + d["demand_uplift"]
        # stock continuity: onhand carries over with arrivals, sales, expiries, donations
        # (transfers net to zero system-wide)
        prev = None
        for d in days:
            if prev is not None:
                assert d["onhand"] == prev["onhand"] + d["arrived"] - d["sales"] - d["expired"] - d["donated"]
            prev = d
        assert sum(d["donated"] for d in days) == m["donated_units"]

def test_seed_provides_demo_history():
    client.post("/api/seed/reset", params={"seed": 42})
    ev = client.get("/api/evaluation").json()
    assert len(ev["scenario_runs"]) > 0
    assert any(s["policy"] == "agentic" for s in ev["scenario_runs"])
    aud = client.get("/api/audit").json()
    assert len(aud["agent_runs"]) > 0 and len(aud["audit_logs"]) > 0

def test_new_run_supersedes_open_proposals():
    client.post("/api/seed/reset", params={"seed": 42})
    first = client.post("/api/agents/run", json={"store_id": "store_001", "sku": "MILK-1L"}).json()
    rec1 = first["results"][0]["rec_id"]
    second = client.post("/api/agents/run", json={"store_id": "store_001", "sku": "MILK-1L"}).json()
    rec2 = second["results"][0]["rec_id"]
    assert rec1 != rec2
    assert client.get(f"/api/recommendations/{rec1}").json()["status"] == "superseded"
    assert client.get(f"/api/recommendations/{rec2}").json()["status"] == "proposed"
    # planner queue keeps exactly one open proposal for the pair; superseded hidden
    proposed = client.get("/api/recommendations", params={"status": "proposed"}).json()["recommendations"]
    assert [r["rec_id"] for r in proposed if r["store_id"] == "store_001" and r["sku"] == "MILK-1L"] == [rec2]
    sup = client.get("/api/recommendations", params={"status": "superseded"}).json()["recommendations"]
    assert rec1 in [r["rec_id"] for r in sup]
    # decided proposals are never superseded
    client.post(f"/api/planner/approve/{rec2}", json={"reason": "lock"})
    third = client.post("/api/agents/run", json={"store_id": "store_001", "sku": "MILK-1L"}).json()
    rec3 = third["results"][0]["rec_id"]
    assert client.get(f"/api/recommendations/{rec2}").json()["status"] == "approved"
