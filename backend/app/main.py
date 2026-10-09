"""ZeroWaste AI FastAPI: documented, Pydantic-validated, API-key auth, Demo Mode."""
from __future__ import annotations
import csv, io, json
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from . import config, database as db
from .seed import seed_all, seed_core
from . import agents as ag
from .coordinator import run_coordinator
from . import scenarios as sc

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging, os
    from .seed import seed_core
    db.init_db()
    if config.AUTO_SEED:
        try:
            conn = db.get_conn()
            n = conn.execute("SELECT COUNT(*) c FROM stores").fetchone()["c"]
            db.release(conn)
            if n == 0:
                if os.getenv("VERCEL"):
                    # serverless cold start: fast core seed only (must fit function limits)
                    logging.getLogger(__name__).info("Empty database: fast core seed (seed=42)")
                    seed_core(42)
                else:
                    logging.getLogger(__name__).info("Empty database: auto-seeding demo data (seed=42)")
                    seed_all(42)
        except Exception as e:
            logging.getLogger(__name__).warning(f"Auto-seed skipped: {e}")
    yield

app = FastAPI(title="ZeroWaste AI API", version="1.0.0", lifespan=lifespan,
    description="Agentic AI for perishable demand & shelf-life. All data synthetic (seed=42). ERP/WMS/POS simulated.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def auth(x_api_key: Optional[str] = Header(default=None)):
    if config.DEMO_MODE: return "demo"
    if x_api_key != config.API_KEY: raise HTTPException(401, "Invalid API key")
    return "planner"

@app.get("/api/health")
def health(): return {"status":"ok","demo_mode":config.DEMO_MODE,"synthetic":True,"seed":42,"asof":db.get_asof()}

class IngestSale(BaseModel):
    store_id: str; sku: str; date: str; units_sold: int = Field(ge=0); unit_price: float = Field(ge=0); promo: int = 0
class Decide(BaseModel):
    reason: str = ""; decided_by: str = "planner"; qty_adjusted: Optional[int] = None
class RunAgents(BaseModel):
    low_thr: float = 0.10; high_thr: float = 0.30; horizon: int = 7; alpha: float = 0.4; store_id: Optional[str]=None; sku: Optional[str]=None
class ScenarioReq(BaseModel):
    preset: str = "demand_spike"; seeds: int = 20; base_seed: int = 42
    overrides: dict = {}  # demand_mult, days, expiry_shift, stock_mult, block_replenish_days

@app.post("/api/seed/reset", dependencies=[Depends(auth)])
def reset(seed: int = 42): return seed_all(seed)

@app.get("/api/stores", dependencies=[Depends(auth)])
def stores():
    c=db.get_conn(); r=[dict(x) for x in c.execute("SELECT * FROM stores").fetchall()]; db.release(c); return {"stores":r}
@app.get("/api/products", dependencies=[Depends(auth)])
def products(category: Optional[str]=None):
    c=db.get_conn()
    q="SELECT * FROM products" + (" WHERE category=%s" if category else "")
    r=[dict(x) for x in c.execute(q, (category,) if category else ()).fetchall()]; db.release(c); return {"products":r,"simulated":True}

@app.get("/api/inventory", dependencies=[Depends(auth)])
def inventory(store_id: Optional[str]=None, category: Optional[str]=None, search: Optional[str]=None,
              sort: str="expiry_date", order: str="asc"):
    allowed={"expiry_date","qty_on_hand","sku","store_id"}
    if sort not in allowed: sort="expiry_date"
    o="DESC" if order=="desc" else "ASC"
    c=db.get_conn()
    q="SELECT b.*, p.name, p.category, p.unit_price, p.unit_weight_kg, p.shelf_life_days FROM inventory_batches b JOIN products p ON p.sku=b.sku WHERE qty_on_hand>0"
    args=[]
    if store_id: q+=" AND b.store_id=%s"; args.append(store_id)
    if category: q+=" AND p.category=%s"; args.append(category)
    if search: q+=" AND (b.sku LIKE %s OR p.name LIKE %s)"; args += [f"%{search}%",f"%{search}%"]
    q+=f" ORDER BY {sort} {o} LIMIT 500"
    rows=[dict(x) for x in c.execute(q,args).fetchall()]; db.release(c)
    return {"inventory":rows,"count":len(rows)}

@app.post("/api/sales/ingest", dependencies=[Depends(auth)])
def ingest(s: IngestSale):
    c=db.get_conn()
    try:
        c.execute("INSERT INTO sales_history (store_id,sku,date,units_sold,unit_price,promo) VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(store_id,sku,date) DO UPDATE SET units_sold=excluded.units_sold, unit_price=excluded.unit_price, promo=excluded.promo",
            (s.store_id,s.sku,s.date,s.units_sold,s.unit_price,s.promo))
        c.commit()
    except Exception as e: raise HTTPException(400,str(e))
    finally: db.release(c)
    db.log_event("pos","sale_ingested",s.model_dump()); db.audit("planner","ingest","sale",f"{s.store_id}-{s.sku}-{s.date}",s.model_dump())
    return {"ok":True,"simulated":"POS"}

@app.get("/api/forecast", dependencies=[Depends(auth)])
def forecast(store_id: str, sku: str, horizon: int = 7, alpha: float = 0.4):
    dates, vals = ag.get_series(store_id, sku)
    if not vals: raise HTTPException(404,"No sales history")
    from .forecasting import forecast_series
    return forecast_series(dates, vals, horizon, alpha)

@app.get("/api/risk", dependencies=[Depends(auth)])
def risk(store_id: str, sku: str, low_thr: float = 0.10, high_thr: float = 0.30, day_offset: int = Query(0, ge=0, le=7)):
    """day_offset: project risk N days ahead using the same FIFO engine (time-travel)."""
    from datetime import date as _date, timedelta as _td
    dates, vals = ag.get_series(store_id, sku)
    from .forecasting import forecast_series
    f = forecast_series(dates, vals, 7)
    batches, _ = ag.get_batches(store_id, sku)
    from .spoilage import assess_risk
    eff = (_date.fromisoformat(db.get_asof()) + _td(days=day_offset)).isoformat()
    out = assess_risk(batches, f["forecast_mean"], f["forecast_low"], f["forecast_high"], low_thr, high_thr, eff)
    out["disclaimer"] = "Estimate from synthetic data, not a real-world guarantee."
    out["day_offset"] = day_offset
    out["effective_date"] = eff
    out["forecast_7d"] = round(sum(f["forecast_mean"][:7]), 1)
    return out

@app.get("/api/agents/runs/{run_id}", dependencies=[Depends(auth)])
def agent_run_detail(run_id: str):
    import json as _json
    c = db.get_conn()
    r = c.execute("SELECT * FROM agent_runs WHERE run_id=%s", (run_id,)).fetchone()
    db.release(c)
    if not r: raise HTTPException(404, "Not found")
    d = dict(r)
    for k, src in (("inputs", "inputs_json"), ("outputs", "outputs_json")):
        try: d[k] = _json.loads(d.pop(src) or "{}")
        except Exception: d[k] = {}
    return d

@app.post("/api/agents/run", dependencies=[Depends(auth)])
def agents_run(r: RunAgents):
    c=db.get_conn()
    stores=[x["store_id"] for x in c.execute("SELECT store_id FROM stores").fetchall()]
    skus=[x["sku"] for x in c.execute("SELECT sku FROM products").fetchall()]
    db.release(c)
    S=[r.store_id] if r.store_id else stores
    K=[r.sku] if r.sku else skus
    results=[]
    for sid in S:
        for sku in K:
            results.append(run_coordinator(sid,sku,r.low_thr,r.high_thr,r.horizon,r.alpha))
    return {"count":len(results),"results":[{"rec_id":x["rec_id"],"store_id":x["store_id"],"sku":x["sku"],"action":x["primary"]["action"],"quantity":x["primary"].get("quantity",0)} for x in results]}

@app.post("/api/agents/replay", dependencies=[Depends(auth)])
def replay(r: RunAgents):
    """Counterfactual replay: re-run with changed thresholds, diff proposals vs latest stored."""
    c=db.get_conn()
    prev={(x["store_id"],x["sku"]):dict(x) for x in c.execute("SELECT * FROM recommendations WHERE status='proposed'").fetchall()}
    db.release(c)
    out=agents_run(r)
    # diff
    c=db.get_conn()
    diffs=[]
    for item in out["results"]:
        key=(item["store_id"],item["sku"])
        old=prev.get(key)
        if old and (old["action_type"]!=item["action"] or old["quantity"]!=item["quantity"]):
            diffs.append({"store_id":item["store_id"],"sku":item["sku"],"before":f"{old['action_type']} x{old['quantity']}","after":f"{item['action']} x{item['quantity']}"})
    db.release(c)
    return {"replayed":out["count"],"diffs":diffs[:50],"diff_count":len(diffs)}

@app.get("/api/recommendations", dependencies=[Depends(auth)])
def recs(status: Optional[str]=None, store_id: Optional[str]=None):
    c=db.get_conn()
    q="SELECT r.*, p.name AS product_name, p.category, p.unit_price FROM recommendations r JOIN products p ON p.sku=r.sku WHERE 1=1"; args=[]
    if status: q+=" AND r.status=%s"; args.append(status)
    if store_id: q+=" AND r.store_id=%s"; args.append(store_id)
    q+=" ORDER BY r.created_at DESC LIMIT 200"
    rows=[dict(x) for x in c.execute(q,args).fetchall()]; db.release(c)
    return {"recommendations":rows}

@app.get("/api/recommendations/{rec_id}", dependencies=[Depends(auth)])
def rec_detail(rec_id: str):
    c=db.get_conn()
    r=c.execute("SELECT r.*, p.name AS product_name, p.category, p.unit_cost, p.unit_price FROM recommendations r JOIN products p ON p.sku=r.sku WHERE rec_id=%s",(rec_id,)).fetchone()
    db.release(c)
    if not r: raise HTTPException(404,"Not found")
    d=dict(r); d["params"]=json.loads(d["params_json"] or "{}"); d["alternatives"]=json.loads(d["alternatives_json"] or "[]")
    return d

def _decide(rec_id: str, decision: str, body: Decide):
    c=db.get_conn()
    r=c.execute("SELECT * FROM recommendations WHERE rec_id=%s",(rec_id,)).fetchone()
    if not r: db.release(c); raise HTTPException(404,"Not found")
    r=dict(r)
    if r["status"]!="proposed": db.release(c); raise HTTPException(400,f"Already {r['status']}")
    qty=body.qty_adjusted if body.qty_adjusted is not None else r["quantity"]
    # safe bounds: 0..on_hand for non-replenish
    if r["action_type"]!="replenish":
        b=c.execute("SELECT SUM(qty_on_hand) q FROM inventory_batches WHERE store_id=%s AND sku=%s",(r["store_id"],r["sku"])).fetchone()["q"] or 0
        if qty<0 or qty>b: db.release(c); raise HTTPException(400,f"Quantity must be 0..{b}")
    new_status="approved" if decision=="approve" else "rejected"
    c.execute("UPDATE recommendations SET status=%s, quantity=%s WHERE rec_id=%s",(new_status,qty,rec_id))
    c.execute("INSERT INTO planner_decisions VALUES (%s,%s,%s,%s,%s,%s,%s)",(db.new_id("dec_"),rec_id,decision,qty,body.reason,body.decided_by,db.now_iso()))
    c.commit(); db.release(c)
    db.audit(body.decided_by,decision,"recommendation",rec_id,{"qty":qty,"reason":body.reason,
             "sku":r["sku"],"store_id":r["store_id"],"action_type":r["action_type"]})
    return {"ok":True,"rec_id":rec_id,"decision":decision,"quantity":qty}

@app.post("/api/planner/approve/{rec_id}", dependencies=[Depends(auth)])
def approve(rec_id: str, b: Decide): return _decide(rec_id,"approve",b)
@app.post("/api/planner/reject/{rec_id}", dependencies=[Depends(auth)])
def reject(rec_id: str, b: Decide): return _decide(rec_id,"reject",b)
@app.post("/api/planner/bulk-approve", dependencies=[Depends(auth)])
def bulk(b: Decide, store_id: Optional[str]=None):
    c=db.get_conn()
    # only low-risk proposals: join risk? approximate: expected_loss small + no-action/markdown/donate
    rows=[dict(x) for x in c.execute("SELECT * FROM recommendations WHERE status='proposed' AND action_type IN ('no-action','markdown','donate')"+(" AND store_id=%s" if store_id else ""), (store_id,) if store_id else ()).fetchall()]
    db.release(c)
    done=[]
    for r in rows: 
        try: done.append(_decide(r["rec_id"],"approve",b))
        except Exception: pass
    return {"bulk_approved":len(done)}

@app.post("/api/execute/{rec_id}", dependencies=[Depends(auth)])
def execute(rec_id: str):
    """Simulated execution (WMS/ERP): re-check stock; fail with reason if changed."""
    c=db.get_conn()
    r=c.execute("SELECT * FROM recommendations WHERE rec_id=%s",(rec_id,)).fetchone()
    if not r: db.release(c); raise HTTPException(404,"Not found")
    r=dict(r)
    if r["status"]!="approved": db.release(c); raise HTTPException(400,"Only approved proposals execute; rejected never execute.")
    onhand=c.execute("SELECT SUM(qty_on_hand) q FROM inventory_batches WHERE store_id=%s AND sku=%s",(r["store_id"],r["sku"])).fetchone()["q"] or 0
    if r["action_type"] in ("markdown","donate","transfer","no-action") and r["quantity"]>onhand:
        c.execute("UPDATE recommendations SET status='failed' WHERE rec_id=%s",(rec_id,)); c.commit(); db.release(c)
        db.log_event("wms","execution_failed",{"rec_id":rec_id,"reason":f"stock changed: need {r['quantity']}, have {onhand}"})
        return {"ok":False,"status":"failed","reason":f"Stock changed: need {r['quantity']}, have {onhand}"}
    # simulate FIFO deduction for donate/transfer/markdown(qty sold approx)
    if r["action_type"] in ("donate","transfer"):
        need=r["quantity"]
        lots=c.execute("SELECT batch_id, qty_on_hand FROM inventory_batches WHERE store_id=%s AND sku=%s AND qty_on_hand>0 ORDER BY expiry_date",(r["store_id"],r["sku"])).fetchall()
        for lot in lots:
            if need<=0: break
            take=min(lot["qty_on_hand"],need); c.execute("UPDATE inventory_batches SET qty_on_hand=qty_on_hand-%s WHERE batch_id=%s",(take,lot["batch_id"])); need-=take
    c.execute("UPDATE recommendations SET status='executed' WHERE rec_id=%s",(rec_id,)); c.commit(); db.release(c)
    db.log_event("erp" if r["action_type"]=="replenish" else "wms","execution_succeeded",{"rec_id":rec_id,"action":r["action_type"]})
    db.audit("system","execute","recommendation",rec_id,{"result":"executed","simulated":True,
             "sku":r["sku"],"store_id":r["store_id"],"action_type":r["action_type"],"quantity":r["quantity"]})
    return {"ok":True,"status":"executed","simulated":True,"message":"Executed inside simulation only."}

@app.get("/api/scenarios/calibration", dependencies=[Depends(auth)])
def calibration():
    """Starting days-of-cover per SKU/store, horizon, and single-seed FIFO outcomes.
    Single seed = calibration snapshot only; reported comparisons use multi-seed means."""
    prods, batches, sales = sc._snapshot()
    store_ids = sorted({b["store_id"] for b in batches})
    cover = []
    for p in prods:
        for sid in store_ids:
            hist = [u for _, u in sales.get((sid, p["sku"]), [])[-14:]] or [1]
            avg = sum(hist) / len(hist)
            on = sum(b["qty_on_hand"] for b in batches if b["store_id"] == sid and b["sku"] == p["sku"])
            cover.append({"sku": p["sku"], "store_id": sid, "cover_days": round(on / max(0.1, avg), 1),
                          "shelf_life_days": p["shelf_life_days"], "on_hand": on})
    fifo = {}
    for preset, params in list(sc.PRESETS.items()):
        m = sc._sim_one_policy("fifo", preset, dict(params), 42)
        fifo[preset] = {"waste_units": m["waste_units"], "stockout_units": m["stockout_units"],
                        "service_level": m["service_level"]}
    return {"asof": db.get_asof(), "horizon_days": 14,
            "note": ("Cover = on-hand / trailing-14d avg daily sales. Short-shelf SKUs cannot cover "
                     "a 14-day horizon: FIFO never reorders, so its stockouts have a structural floor "
                     "(verified: scaling excess_inventory 2x-6x leaves ~8k stockouts while waste explodes). "
                     "Surplus therefore shows as waste + ending on-hand, not zero stockouts. "
                     "A reordering policy (fixed-threshold) reaches >= 0.9 service on baseline."),
            "cover": cover, "fifo_single_seed": fifo, "presets": sc.PRESETS}

@app.post("/api/scenarios/run", dependencies=[Depends(auth)])
def scen_run(s: ScenarioReq):
    if s.preset not in sc.PRESETS: raise HTTPException(400,f"Unknown preset. Choose {list(sc.PRESETS)}")
    cap = 5 if config.PRODUCTION else 20
    seeds = max(1, min(s.seeds, cap))
    out = sc.run_scenario(s.preset, seeds, s.base_seed, s.overrides or None)
    out["seeds_run"] = seeds
    out["seeds_capped"] = seeds < s.seeds
    return out

@app.get("/api/evaluation", dependencies=[Depends(auth)])
def evaluation():
    import json as _json
    def _parse(v, fb):
        try: return _json.loads(v) if isinstance(v, str) else v
        except Exception: return fb
    c=db.get_conn()
    scns=[]
    for x in c.execute("SELECT * FROM scenario_runs ORDER BY created_at DESC LIMIT 60").fetchall():
        r = dict(x)
        r["params"] = _parse(r.pop("params_json", None), {})
        r["metrics"] = _parse(r.pop("metrics_json", None), {})
        scns.append(r)
    dec=[dict(x) for x in c.execute("SELECT decision, COUNT(*) n FROM planner_decisions GROUP BY decision").fetchall()]
    rec=[dict(x) for x in c.execute("SELECT status, COUNT(*) n FROM recommendations GROUP BY status").fetchall()]
    db.release(c)
    latest = _latest_comparison(scns)
    return {"scenario_runs":scns,"decisions":dec,"recommendation_status":rec,
            "latest_comparison":latest,
            "methodology":"Identical demand/inventory/seeds per policy; 14-day horizon; waste units+cost, stockout, revenue (gross), service, runtime; mean+min-max over seeds.",
            "assumptions":"Synthetic data; elasticity 1.5; transfer $0.30/u; order fixed $2; donation recovery 40% cost; revenue is gross (pre-markdown); COGS = sold units x unit cost; total_cost = ordering fees + waste + markdown give-away - donation recovery; net_margin = revenue - COGS - waste - markdown - ordering fees; agentic stockout counts include markdown-induced demand."}

def _latest_comparison(rows: list) -> dict | None:
    """Side-by-side agentic vs baselines for the most recent (preset, seed) run set."""
    if not rows: return None
    newest = rows[0]
    preset, seed = newest["scenario_name"], newest["seed"]
    by_policy = {}
    for r in rows:
        if r["scenario_name"] != preset or r["seed"] != seed: continue
        m = r.get("metrics") or {}
        if m: by_policy[r["policy"]] = m
    if "agentic" not in by_policy or "fifo" not in by_policy: return None
    n_seeds = 0
    try: n_seeds = int((newest.get("params") or {}).get("_seeds", 0))
    except Exception: pass
    from .scenarios import waste_reduction_summary, trade_off_summary
    wf = by_policy["fifo"]["waste_units"]["mean"]; wa = by_policy["agentic"]["waste_units"]["mean"]
    pct, note = waste_reduction_summary(wf, wa, n_seeds)
    return {"preset": preset, "seed": seed, "seeds": n_seeds, "policies": by_policy,
            "waste_reduction_pct": pct, "waste_reduction_note": note,
            "trade_off_note": trade_off_summary(by_policy["fifo"], by_policy["agentic"], preset, n_seeds)}

@app.get("/api/audit", dependencies=[Depends(auth)])
def audit_logs(limit: int = 100):
    import json as _json
    def _parse(v):
        try: return _json.loads(v) if isinstance(v, str) else v
        except Exception: return v
    c=db.get_conn()
    a=[]
    for x in c.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT %s", (limit,)).fetchall():
        r = dict(x); r["details"] = _parse(r.pop("details_json", None)); a.append(r)
    e=[]
    for x in c.execute("SELECT * FROM sim_system_events ORDER BY created_at DESC LIMIT %s", (limit,)).fetchall():
        r = dict(x); r["payload"] = _parse(r.pop("payload_json", None)); e.append(r)
    runs=[dict(x) for x in c.execute("SELECT run_id, created_at, agent_name, store_id, sku, status, duration_ms FROM agent_runs ORDER BY created_at DESC LIMIT %s", (limit,)).fetchall()]
    counts=[dict(x) for x in c.execute("SELECT agent_name, COUNT(*) n FROM agent_runs GROUP BY agent_name").fetchall()]
    db.release(c); return {"audit_logs":a,"system_events":e,"agent_runs":runs,"agent_counts":counts}

@app.get("/api/export/csv", dependencies=[Depends(auth)])
def export_csv(kind: str = Query("recommendations", pattern="^(recommendations|scenarios|audit)$")):
    c=db.get_conn()
    if kind=="recommendations": rows=[dict(x) for x in c.execute("SELECT * FROM recommendations").fetchall()]
    elif kind=="scenarios": rows=[dict(x) for x in c.execute("SELECT * FROM scenario_runs").fetchall()]
    else: rows=[dict(x) for x in c.execute("SELECT * FROM audit_logs").fetchall()]
    db.release(c)
    buf=io.StringIO()
    if rows: w=csv.DictWriter(buf, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    else: buf.write("empty\n")
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition":f"attachment; filename={kind}.csv"})
