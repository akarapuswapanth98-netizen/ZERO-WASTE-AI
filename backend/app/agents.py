"""Five deterministic agents + data access helpers. LLM never computes numbers."""
from __future__ import annotations
import json, time
from datetime import date
from . import database as db
from . import forecasting as fc
from . import spoilage as sp

def _today() -> str:
    return db.get_asof()
ELASTICITY = 1.5  # labelled price-elasticity assumption for markdowns
TRANSFER_COST = 0.30
ORDER_FIXED_COST = 2.0
DONATION_VALUE_RATE = 0.4  # recovery per unit donated (goodwill/tax), labelled
DONATION_HANDLING = 0.05

def markdown_eligible(risk: dict, dem_before_expiry: float):
    """Markdown guard: (ok, reason). No markdown without at-risk units, or when a
    stock-out is projected before expiry (a discount would only give margin away)."""
    if risk.get("at_risk_mean", 0) <= 0:
        return False, "guarded: no at-risk units — stock is projected to sell through, a discount would only give away margin"
    if risk.get("on_hand", 0) < dem_before_expiry:
        return False, "guarded: projected stock-out before expiry — discount would only give away margin on units that will sell anyway"
    return True, ""

def _record(agent, store_id, sku, inputs, outputs, ms, status="ok", error=""):
    conn = db.get_conn()
    rid = db.new_id("run_")
    conn.execute("INSERT INTO agent_runs VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (rid, db.now_iso(), agent, store_id, sku, json.dumps(inputs,default=str), json.dumps(outputs,default=str), ms, status, error))
    conn.commit(); db.release(conn)
    return rid

def get_series(store_id, sku):
    conn = db.get_conn()
    rows = conn.execute("SELECT date, units_sold FROM sales_history WHERE store_id=%s AND sku=%s ORDER BY date", (store_id,sku)).fetchall()
    db.release(conn)
    return [r["date"] for r in rows], [r["units_sold"] for r in rows]

def get_batches(store_id, sku):
    conn = db.get_conn()
    rows = conn.execute("SELECT * FROM inventory_batches WHERE store_id=%s AND sku=%s AND qty_on_hand>0 ORDER BY expiry_date", (store_id,sku)).fetchall()
    prods = conn.execute("SELECT * FROM products WHERE sku=%s", (sku,)).fetchone()
    db.release(conn)
    return [dict(r) for r in rows], dict(prods) if prods else {}

def demand_agent(store_id, sku, horizon=7, alpha=0.4):
    t0=time.time(); dates, vals = get_series(store_id, sku)
    out = fc.forecast_series(dates, vals, horizon, alpha)
    ms=int((time.time()-t0)*1000)
    _record("demand_forecasting", store_id, sku, {"horizon":horizon,"alpha":alpha,"n":len(vals)}, out, ms)
    return out

def risk_agent(store_id, sku, forecast, low_thr=0.10, high_thr=0.30):
    t0=time.time(); batches, prod = get_batches(store_id, sku)
    out = sp.assess_risk(batches, forecast["forecast_mean"], forecast["forecast_low"], forecast["forecast_high"], low_thr, high_thr, _today())
    out["product"]=prod
    ms=int((time.time()-t0)*1000)
    _record("spoilage_risk", store_id, sku, {"low_thr":low_thr,"high_thr":high_thr}, out, ms)
    return out

def inventory_analysis_agent(store_id, sku, forecast, risk):
    """Find excess/shortage + transfer opportunities for this SKU across stores."""
    t0=time.time()
    conn=db.get_conn()
    stores=[dict(r) for r in conn.execute("SELECT * FROM stores").fetchall()]
    db.release(conn)
    # shortage: on_hand < 3d demand; excess: high band
    dem3 = sum(forecast["forecast_mean"][:3])
    on_hand = risk["on_hand"]
    shortage = max(0, dem3 - on_hand)
    excess = risk["at_risk_mean"] if risk["band"]=="High" else 0
    # scan other stores for need (same sku)
    opportunities=[]
    for s in stores:
        if s["store_id"]==store_id: continue
        d2, v2 = get_series(s["store_id"], sku)
        f2 = fc.forecast_series(d2, v2, 7)
        b2, _ = get_batches(s["store_id"], sku)
        r2 = sp.assess_risk(b2, f2["forecast_mean"], f2["forecast_low"], f2["forecast_high"], 0.10, 0.30, _today())
        need = max(0, sum(f2["forecast_mean"][:3]) - r2["on_hand"])
        if need>0 and excess>0:
            opportunities.append({"to_store":s["store_id"],"need":int(need),"their_on_hand":r2["on_hand"]})
    out={"on_hand":on_hand,"demand_3d":round(dem3,1),"shortage":int(round(shortage)),"excess_at_risk":int(excess),"transfer_opportunities":opportunities}
    _record("inventory_analysis", store_id, sku, {"sku":sku}, out, int((time.time()-t0)*1000))
    return out

def action_recommendation_agent(store_id, sku, forecast, risk, analysis, prod):
    """Score no-action/markdown/donate/transfer/replenish. Expected loss = waste+giveaway+transfer+shortage-recovery."""
    t0=time.time()
    c=prod["unit_cost"]; p=prod["unit_price"]
    margin=p-c
    on_hand=risk["on_hand"]; at_risk=risk["at_risk_mean"]
    dem7=sum(forecast["forecast_mean"][:7]); dem3=sum(forecast["forecast_mean"][:3])
    shortfall=max(0, dem7-on_hand)
    options=[]
    # no-action
    loss_no = at_risk*c + shortfall*margin*0.5  # 50% of shortfall becomes lost sale (rest substitutes)
    options.append({"action":"no-action","quantity":0,"expected_loss":round(loss_no,2),"detail":f"Waste {at_risk}u x ${c} + possible stockout {shortfall:.0f}u"})
    # markdown depths (behind the markdown guard)
    days_first = risk.get("days_to_first_expiry", 0)
    dem_before_expiry = float(sum(forecast["forecast_mean"][:max(0, days_first)]))
    md_ok, md_reason = markdown_eligible(risk, dem_before_expiry)
    guards = []
    if md_ok:
        for d in (0.10,0.20,0.30,0.50):
            uplift = dem7*(1+ELASTICITY*d)
            sold = min(on_hand, uplift)
            unsold = max(0, on_hand-uplift)
            giveaway = sold*p*d
            loss = unsold*c + giveaway*0.6  # 60% of discount is true loss (rest drives traffic), labelled
            options.append({"action":"markdown","quantity":int(round(sold)),"discount":d,"expected_loss":round(loss,2),
                            "detail":f"{int(d*100)}% off: uplift demand to {uplift:.0f}, unsold {unsold:.0f}, giveaway ${giveaway:.2f} (elasticity {ELASTICITY})"})
    else:
        guards.append({"action":"markdown","quantity":0,"expected_loss":None,"feasible":False,
                       "reason":md_reason,
                       "detail":f"Markdown guard: at-risk {at_risk}u, demand before first expiry ~{dem_before_expiry:.0f}u vs {on_hand}u on hand."})
    # donate at-risk
    shelf_ok = risk["days_to_first_expiry"]>=1
    if shelf_ok and at_risk>0:
        rec = at_risk*c*DONATION_VALUE_RATE
        loss = at_risk*DONATION_HANDLING - rec + (0)  # waste avoided
        options.append({"action":"donate","quantity":int(at_risk),"expected_loss":round(loss,2),
                        "detail":f"Donate {at_risk}u with >=1d shelf left; recovery ${rec:.2f}, handling ${at_risk*DONATION_HANDLING:.2f}"})
    # transfer to best needy store
    if analysis["transfer_opportunities"] and at_risk>0:
        best=max(analysis["transfer_opportunities"], key=lambda o:o["need"])
        qty=int(min(at_risk, best["need"]))
        if qty>0:
            loss = qty*TRANSFER_COST - qty*margin*0.7  # avoids stockout margin at dest
            options.append({"action":"transfer","quantity":qty,"to_store":best["to_store"],"expected_loss":round(loss,2),
                            "detail":f"Move {qty}u to {best['to_store']} (need {best['need']}u); cost ${qty*TRANSFER_COST:.2f}, avoids lost margin"})
    # replenish if not high spoilage and shortage exists
    if risk["band"]!="High" and shortfall>0:
        qty=int(round(shortfall))
        loss = ORDER_FIXED_COST + qty*c - qty*margin*0.8
        options.append({"action":"replenish","quantity":qty,"expected_loss":round(loss,2),
                        "detail":f"Order {qty}u; fixed ${ORDER_FIXED_COST} + cost ${qty*c:.2f}, expected margin ${qty*margin*0.8:.2f}"})
    for o in options: o["feasible"]=True
    _record("action_recommendation", store_id, sku, {"on_hand":on_hand,"at_risk":at_risk}, {"options":options,"guards":guards}, int((time.time()-t0)*1000))
    return options + guards
