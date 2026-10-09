"""Coordinator: deterministic validation + constraint enforcement + min-loss selection."""
from __future__ import annotations
import json
from . import database as db
from . import agents as ag
from .gemini import explain

TIE_ORDER = ["no-action","markdown","donate","transfer","replenish"]

def run_coordinator(store_id: str, sku: str, low_thr=0.10, high_thr=0.30, horizon=7, alpha=0.4) -> dict:
    forecast = ag.demand_agent(store_id, sku, horizon, alpha)
    risk = ag.risk_agent(store_id, sku, forecast, low_thr, high_thr)
    analysis = ag.inventory_analysis_agent(store_id, sku, forecast, risk)
    prod = risk.get("product", {})
    options = ag.action_recommendation_agent(store_id, sku, forecast, risk, analysis, prod)
    # guard rejections ride along for the "Why this action?" view, but never compete
    guards = [o for o in options if o.get("feasible") is False]
    candidates = [o for o in options if o.get("feasible") is not False]
    # validate + enforce constraints (never by LLM)
    feasible, violations = [], []
    _df = risk.get("days_to_first_expiry", 0)
    _dem_bef = float(sum(forecast["forecast_mean"][:max(0, _df)]))
    for o in candidates:
        ok, why = True, ""
        q = int(o.get("quantity",0))
        if q < 0 or q > max(0, risk["on_hand"]) + (10000 if o["action"]=="replenish" else 0):
            ok, why = False, f"quantity {q} out of bounds"
        if o["action"]=="markdown" and (risk["at_risk_mean"]<=0 or risk["on_hand"] < _dem_bef):
            ok, why = False, "markdown guard: no at-risk units or stock-out projected before expiry"
        if o["action"]=="transfer" and (not o.get("to_store") or o["to_store"]==store_id):
            ok, why = False, "transfer needs different receiving store"
        if o["action"]=="transfer":
            need = next((x["need"] for x in analysis["transfer_opportunities"] if x["to_store"]==o.get("to_store")), 0)
            if need<=0: ok, why = False, "receiving store has no quantified need"
        if o["action"]=="replenish" and risk["band"]=="High":
            ok, why = False, "no replenishment into high-spoilage position"
        if o["action"]=="donate" and risk["days_to_first_expiry"]<1:
            ok, why = False, "donation needs >=1 day shelf life"
        if ok: feasible.append(o)
        else: violations.append({"option":o,"reason":why})
    # min-loss + tie-break
    feasible.sort(key=lambda o:(o["expected_loss"], TIE_ORDER.index(o["action"])))
    primary = feasible[0] if feasible else {"action":"no-action","quantity":0,"expected_loss":0.0,"detail":"fallback"}
    alternatives = [o for o in feasible[1:]] + guards
    explanation = explain(store_id, sku, prod, forecast, risk, primary, feasible)
    # one open proposal per (store, SKU): supersede older undecided proposals for the pair
    conn = db.get_conn()
    old = [dict(x) for x in conn.execute(
        "SELECT rec_id FROM recommendations WHERE store_id=%s AND sku=%s AND status='proposed'",
        (store_id, sku)).fetchall()]
    if old:
        conn.execute("UPDATE recommendations SET status='superseded' WHERE store_id=%s AND sku=%s AND status='proposed'",
                     (store_id, sku))
    rec_id, run_id = db.new_id("rec_"), db.new_id("coord_")
    conn.execute("INSERT INTO agent_runs VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (run_id, db.now_iso(), "coordinator", store_id, sku,
         json.dumps({"low_thr":low_thr,"high_thr":high_thr,"horizon":horizon}), json.dumps({"primary":primary,"violations":violations}), 0, "ok", ""))
    conn.execute("INSERT INTO recommendations VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (rec_id, run_id, store_id, sku, primary["action"], int(primary.get("quantity",0)),
         json.dumps(primary,default=str), float(primary.get("expected_loss",0)),
         float(max(0, risk["at_risk_mean"]-(primary.get("quantity",0) if primary["action"] in ("donate","transfer") else 0))),
         0.75, explanation, json.dumps(alternatives,default=str), "proposed", db.now_iso()))
    conn.commit(); db.release(conn)
    db.log_event("coordinator", "proposal_created", {"store_id": store_id, "sku": sku, "action": primary["action"], "rec_id": rec_id})
    if old:
        db.audit("coordinator", "supersede", "recommendation", rec_id,
                 {"store_id": store_id, "sku": sku, "superseded": [o["rec_id"] for o in old]})
    db.audit("coordinator", "propose", "recommendation", rec_id,
             {"store_id": store_id, "sku": sku, "action_type": primary["action"],
              "quantity": int(primary.get("quantity", 0)), "primary": primary})
    return {"rec_id":rec_id,"store_id":store_id,"sku":sku,"product":prod,"forecast":forecast,"risk":risk,
            "analysis":analysis,"primary":primary,"alternatives":alternatives,"violations":violations,"explanation":explanation}
