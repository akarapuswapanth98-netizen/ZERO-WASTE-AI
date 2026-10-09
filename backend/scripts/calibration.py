"""Calibration: days-of-cover per SKU at reset + horizon + FIFO outcome per scenario."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.seed import seed_all
seed_all(42)
from app import scenarios as sc
from datetime import date

prods, batches0, sales = sc._snapshot()
print(f"asof={date.today().isoformat()} horizon=14")
print("SKU store cover_days(onhand/avg_d14)")
for p in prods:
    row = []
    for sid in sorted({b["store_id"] for b in batches0}):
        hist = [u for _, u in sales.get((sid, p["sku"]), [])[-14:]] or [1]
        avg = sum(hist) / len(hist)
        on = sum(b["qty_on_hand"] for b in batches0 if b["store_id"] == sid and b["sku"] == p["sku"])
        row.append(f"{sid[-3:]}:{on/max(0.1,avg):.1f}d")
    print(f"  {p['sku']:10s} shelf={p['shelf_life_days']:2d} " + " ".join(row))
for preset in list(sc.PRESETS) + ["baseline"]:
    params = dict(sc.PRESETS.get(preset, {}))
    m = sc._sim_one_policy("fifo", preset, params, 42)
    print(f"FIFO {preset:16s} waste={m['waste_units']:5d} stockout={m['stockout_units']:6d} service={m['service_level']}")
