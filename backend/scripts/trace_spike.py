"""Day-by-day trace: demand_spike, seed 42, single seed per policy + calibration check."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.seed import seed_all
seed_all(42)
from app import scenarios as sc

for pol in ("agentic", "fifo", "fixed-threshold"):
    days = []
    m = sc._sim_one_policy(pol, "demand_spike", dict(sc.PRESETS["demand_spike"]), 42, collect=days)
    print(f"== {pol}: sales={m['sales_units']} stockout={m['stockout_units']} waste={m['waste_units']} "
          f"revenue={m['revenue']} cogs={m['cogs']} markdown={m['markdown_cost']} order_fees={m['order_cost']} "
          f"purchase={m['purchase_cost']} donated={m['donated_units']} net_margin={m['net_margin']}")
    tot_base = sum(d["demand_base"] for d in days)
    tot_up = sum(d["demand_uplift"] for d in days)
    print(f"   base demand={tot_base} markdown uplift={tot_up} ({100*tot_up/max(1,tot_base):.1f}% of base)")
    for d in days:
        if d["day"] in (0, 1, 2, 6, 7, 13):
            print(f"   day {d['day']:2d}: dem={d['demand_base']:5d}+{d['demand_uplift']:4d}up sales={d['sales']:5d} "
                  f"so={d['stockout']:5d} exp={d['expired']:4d} arr={d['arrived']:4d} onhand={d['onhand']:5d}")
