"""Reproducible synthetic seed (seed=42). 5 stores, 18 SKUs, 6 categories,
12 weeks of daily sales with weekday/payday/weather effects, 2-4 batches each,
plus seeded demo history (agent runs + one scenario set) so Evaluation/Audit
are non-empty on first load."""
from __future__ import annotations
import os
from datetime import date, timedelta
import numpy as np
from . import database as db

STORES = [
    ("store_001", "Downtown Fresh", "HITAM Road", 1.00),
    ("store_002", "Suburb Mart", "Gandipet", 0.80),
    ("store_003", "Campus Grocer", "HITAM Campus", 1.20),
    ("store_004", "Old City Bazaar", "Old City", 0.65),
    ("store_005", "Hitech MiniMart", "Hitech City", 1.10),
]

# sku, name, category, unit_cost, unit_price, shelf_life_days, unit_weight_kg, base_demand, lead_days, moq
PRODUCTS = [
    ("MILK-1L", "Whole Milk 1L", "dairy", 0.90, 1.49, 7, 1.03, 20, 1, 12),
    ("YOG-500G", "Greek Yogurt 500g", "dairy", 1.20, 1.99, 14, 0.50, 12, 2, 12),
    ("CHED-200G", "Cheddar 200g", "dairy", 2.00, 3.49, 30, 0.20, 6, 3, 6),
    ("EGGS-12", "Eggs 12pk", "dairy", 1.80, 2.99, 21, 0.72, 15, 2, 12),
    ("PANEER-200G", "Fresh Paneer 200g", "dairy", 1.50, 2.79, 4, 0.20, 9, 1, 12),
    ("BREAD-WH", "Whole Wheat Bread", "bakery", 0.80, 1.99, 5, 0.40, 18, 1, 12),
    ("CROIS-4PK", "Butter Croissant 4pk", "bakery", 1.10, 2.99, 3, 0.32, 10, 1, 12),
    ("BUN-6PK", "Burger Buns 6pk", "bakery", 0.90, 2.29, 6, 0.36, 11, 1, 12),
    ("TOM-500G", "Cherry Tomatoes 500g", "produce", 0.70, 1.79, 6, 0.50, 14, 1, 12),
    ("SPIN-200G", "Baby Spinach 200g", "produce", 0.90, 2.49, 5, 0.20, 9, 1, 12),
    ("BAN-1KG", "Bananas 1kg", "produce", 0.60, 1.29, 7, 1.00, 22, 1, 12),
    ("AVOC-2PK", "Avocado 2pk", "produce", 1.40, 2.99, 5, 0.40, 8, 2, 6),
    ("CHKN-500G", "Chicken Breast 500g", "meat", 3.00, 5.99, 4, 0.50, 11, 2, 6),
    ("SALM-300G", "Salmon Fillet 300g", "seafood", 4.50, 8.99, 3, 0.30, 7, 2, 6),
    ("FISH-400G", "Rohu Fish 400g", "seafood", 3.20, 6.49, 3, 0.40, 6, 1, 6),
    ("VEG-BIRY", "Veg Biryani 350g", "ready-to-eat", 1.80, 3.49, 3, 0.35, 13, 1, 12),
    ("CHKN-WRAP", "Chicken Wrap", "ready-to-eat", 2.20, 4.29, 3, 0.28, 10, 1, 12),
    ("FRUIT-CUP", "Fruit Cup 250g", "ready-to-eat", 1.00, 2.19, 4, 0.25, 8, 1, 12),
]

WEEKS = 12
NDAYS = WEEKS * 7

def _asof() -> date:
    """Reset date: AS_OF override (tests) or today. Seed randomness still uses seed=42."""
    return date.fromisoformat(os.getenv("AS_OF", date.today().isoformat()))

def _bounds() -> tuple[date, date]:
    asof = _asof()
    return asof - timedelta(days=NDAYS), asof  # sales: [start, asof) then batches at asof

STORE_MULT = {s[0]: s[3] for s in STORES}
BASE_MAP = {p[0]: p[7] for p in PRODUCTS}
CAT_MAP = {p[0]: p[2] for p in PRODUCTS}
PRICE_MAP = {p[0]: p[4] for p in PRODUCTS}
COST_MAP = {p[0]: p[3] for p in PRODUCTS}

def weekday_factor(d: date, category: str, store_id: str) -> float:
    wd = d.weekday()
    f = 1.0
    if category in ("bakery", "produce"):
        if wd in (5, 6):
            f *= 1.25
        if wd == 0:
            f *= 0.90
    if category == "meat" and wd in (5, 6):
        f *= 1.15
    if category == "ready-to-eat":
        if wd in (1, 2, 3) and store_id == "store_005":
            f *= 1.30  # weekday lunch peak near offices
        if wd in (5, 6):
            f *= 1.15
    if store_id == "store_004" and wd in (5, 6):
        f *= 1.20  # bazaar weekend rush
    # payday bump on 1st and 15th for premium categories
    if d.day in (1, 15) and category in ("meat", "seafood", "ready-to-eat"):
        f *= 1.20
    return f

def seed_core(seed: int = 42) -> dict:
    """Fast core seed: schema + stores/products/sales/batches only, batched inserts.
    Safe for serverless cold starts (no agent runs, no scenarios). Idempotent."""
    rng = np.random.default_rng(seed)
    db.init_db()
    start, today = _bounds()
    db.set_meta("asof", today.isoformat())
    conn = db.get_conn()
    for t in ["planner_decisions", "recommendations", "agent_runs", "sales_history",
              "inventory_batches", "products", "stores", "sim_system_events",
              "scenario_runs", "audit_logs"]:
        conn.execute(f"DELETE FROM {t}")
    db.executemany("INSERT INTO stores VALUES (%s,%s,%s)",
                     [(sid, name, loc) for sid, name, loc, _ in STORES])
    db.executemany("INSERT INTO products VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                     [(sku, name, cat, cost, price, shelf, wt, lead, moq)
                      for sku, name, cat, cost, price, shelf, wt, _, lead, moq in PRODUCTS])
    # weather-like smooth multiplier per store (random walk 0.85..1.15)
    weather = {}
    for sid, _, _, _ in STORES:
        walk = [1.0]
        for _ in range(NDAYS - 1):
            walk.append(float(np.clip(walk[-1] + rng.normal(0, 0.02), 0.85, 1.15)))
        weather[sid] = walk
    sales_rows = []
    for sid, _, _, _ in STORES:
        for sku in BASE_MAP:
            base = BASE_MAP[sku] * STORE_MULT[sid]
            for i in range(NDAYS):
                d = start + timedelta(days=i)
                mu = base * weekday_factor(d, CAT_MAP[sku], sid) * weather[sid][i]
                promo = 1 if (CAT_MAP[sku] in ("bakery", "produce") and i % 14 == 9) else 0
                if promo:
                    mu *= 1.35
                units = int(max(0, round(rng.normal(mu, mu * 0.15))))
                sales_rows.append((sid, sku, d.isoformat(), units,
                                    round(PRICE_MAP[sku] * (0.8 if promo else 1.0), 2), promo))
    db.executemany(
        "INSERT INTO sales_history (store_id,sku,date,units_sold,unit_price,promo) VALUES (%s,%s,%s,%s,%s,%s)",
        sales_rows)
    # inventory batches: 2-4 per store/SKU with deliberate imbalances
    batch_rows = []
    for sid, _, _, _ in STORES:
        for sku, _, _, cost, _, shelf, _, base, _, _ in PRODUCTS:
            avg = base * STORE_MULT[sid]
            near_days = {"CROIS-4PK": 1, "SALM-300G": 1, "FISH-400G": 1, "VEG-BIRY": 1,
                         "CHKN-WRAP": 1, "CHKN-500G": 2, "BREAD-WH": 2, "SPIN-200G": 2,
                         "PANEER-200G": 2, "FRUIT-CUP": 2}.get(sku, 3)
            mult_near, mult_mid, mult_far = 1.0, 1.0, 1.0
            if sid == "store_001" and sku in ("BREAD-WH", "MILK-1L"):
                mult_near, mult_far = 2.2, 1.5
            if sid == "store_002" and sku == "BREAD-WH":
                mult_near, mult_far = 0.25, 0.25
            if sid == "store_002" and sku == "SPIN-200G":
                mult_near, mult_far = 2.0, 1.4
            if sid == "store_003" and sku == "BAN-1KG":
                mult_near, mult_far = 2.0, 1.6
            if sid == "store_003" and sku == "SALM-300G":
                mult_near, mult_far = 0.4, 0.5
            if sid == "store_004" and CAT_MAP[sku] == "bakery":
                mult_near, mult_mid, mult_far = 2.1, 1.5, 1.2
            if sid == "store_004" and CAT_MAP[sku] == "seafood":
                mult_near, mult_far = 0.35, 0.4
            if sid == "store_005" and CAT_MAP[sku] == "ready-to-eat":
                mult_near, mult_mid, mult_far = 1.9, 1.3, 1.0
            if sid == "store_005" and sku == "MILK-1L":
                mult_near, mult_far = 0.5, 0.6
            q_near = int(max(1, round(avg * near_days * 0.9 * mult_near) + rng.integers(-2, 3)))
            q_far = int(max(1, round(avg * max(1, shelf - near_days) * 0.55 * mult_far) + rng.integers(-2, 3)))
            specs = [
                (f"{sid}-{sku}-A", q_near, today - timedelta(days=max(0, shelf - near_days - 1)),
                 today + timedelta(days=near_days)),
                (f"{sid}-{sku}-B", q_far, today - timedelta(days=1),
                 today + timedelta(days=shelf - 1)),
            ]
            if shelf >= 5 and rng.random() < 0.6:  # mid batch for longer shelf lives
                q_mid = int(max(1, round(avg * 2 * mult_mid)))
                specs.append((f"{sid}-{sku}-C", q_mid, today - timedelta(days=2),
                              today + timedelta(days=max(near_days + 1, shelf // 2))))
            for bid, q, recv, exp in specs:
                q = max(0, q)
                batch_rows.append((bid, sid, sku, q + int(rng.integers(0, 4)), q,
                                   recv.isoformat(), exp.isoformat(), cost))
    db.executemany("INSERT INTO inventory_batches VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", batch_rows)
    conn.commit()
    counts = {}
    for t in ["stores", "products", "sales_history", "inventory_batches"]:
        counts[t] = conn.execute(f"SELECT COUNT(*) c FROM {t}").fetchone()["c"]
    db.release(conn)
    db.log_event("seed", "seed_completed",
                 {"seed": seed, "counts": counts, "seeded_demo_history": False})
    db.audit("system", "seed", "database", "all", {"seed": seed, **counts})
    return {"seed": seed, "counts": counts, "synthetic": True, "asof": today.isoformat(),
            "note": "Synthetic demo data, seed=42 reproducible. Dates relative to reset date."}


def seed_all(seed: int = 42, with_history: bool = True) -> dict:
    """Full reset: fast core seed plus demo history (proposals, decisions, scenario)."""
    out = seed_core(seed)
    if with_history:
        _seed_demo_history(seed)
        out = {**out, "seeded_demo_history": True}
    return out

def _seed_demo_history(seed: int) -> None:
    """A few proposals + decisions + one scenario set, marked as seeded demo history."""
    from .coordinator import run_coordinator
    from . import scenarios as sc
    # full cover: one proposal per (store, SKU) so the Planner queue is complete on first load
    skus = [p[0] for p in PRODUCTS]
    targets = [(s[0], sku) for s in STORES for sku in skus]
    rec_ids: list[str] = []
    rec_pairs: list[tuple[str, str]] = []
    for sid, sku in targets:
        try:
            rec_ids.append(run_coordinator(sid, sku)["rec_id"])
            rec_pairs.append((sid, sku))
        except Exception:
            continue
    conn = db.get_conn()
    try:
        if rec_ids:
            conn.execute("UPDATE recommendations SET status='approved' WHERE rec_id=%s", (rec_ids[0],))
            conn.execute("INSERT INTO planner_decisions VALUES (%s,%s,%s,%s,%s,%s,%s)",
                         (db.new_id("dec_"), rec_ids[0], "approve", None,
                          "seeded demo history", "seed", db.now_iso()))
            conn.execute("UPDATE recommendations SET status='executed' WHERE rec_id=%s", (rec_ids[0],))
        if len(rec_ids) > 1:
            conn.execute("UPDATE recommendations SET status='rejected' WHERE rec_id=%s", (rec_ids[1],))
            conn.execute("INSERT INTO planner_decisions VALUES (%s,%s,%s,%s,%s,%s,%s)",
                         (db.new_id("dec_"), rec_ids[1], "reject", None,
                          "seeded demo history", "seed", db.now_iso()))
        conn.commit()
    finally:
        db.release(conn)
    # re-propose the two decided pairs so every pair still has exactly one open proposal
    for sid, sku in rec_pairs[:2]:
        try:
            run_coordinator(sid, sku)
        except Exception:
            pass
    if rec_ids:
        db.log_event("seed", "execution_succeeded",
                     {"rec_id": rec_ids[0], "seeded_demo_history": True})
    try:
        sc.run_scenario("excess_inventory", seeds=5, base_seed=seed)
    except Exception:
        pass
    db.audit("seed", "seed_history", "database", "demo",
             {"note": "Seeded demo history: proposals, 1 executed, 1 rejected, 1 scenario set."})
