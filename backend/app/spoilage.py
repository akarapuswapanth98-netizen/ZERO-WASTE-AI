"""Spoilage risk via FIFO consumption of batches against forecast demand."""
from __future__ import annotations
from datetime import date
from copy import deepcopy

def assess_risk(batches: list[dict], forecast_mean: list[float], forecast_low: list[float],
                forecast_high: list[float], low_thr: float = 0.10, high_thr: float = 0.30,
                today: str = "") -> dict:
    if not today:
        from . import database as _db
        today = _db.get_asof()
    """batches: [{batch_id, qty_on_hand, expiry_date, ...}] sorted by expiry.
    Returns at-risk units (projected unsold before expiry), ratio, band, range, reason."""
    t = date.fromisoformat(today)
    on_hand = sum(b["qty_on_hand"] for b in batches)
    if on_hand <= 0:
        return {"on_hand":0,"at_risk_mean":0,"at_risk_low_demand":0,"at_risk_high_demand":0,
                "risk_ratio":0.0,"band":"Low","range":[0.0,0.0],"reason":"No stock on hand.","days_to_first_expiry":0}
    # max horizon = days until latest expiry (cap 14)
    expiries = sorted([date.fromisoformat(b["expiry_date"]) for b in batches])
    horizon = max(1, min(14, (max(expiries) - t).days + 1))
    # extend forecasts if needed (repeat last)
    def ext(f):
        f=list(f); 
        while len(f)<horizon: f.append(f[-1] if f else 0)
        return f[:horizon]
    fm, fl, fh = ext(forecast_mean), ext(forecast_low), ext(forecast_high)
    def fifo_waste(daily: list[float]) -> int:
        lots = sorted(deepcopy(batches), key=lambda b: b["expiry_date"])
        # consume day by day
        for d in range(horizon):
            need = daily[d]
            for lot in lots:
                exp = date.fromisoformat(lot["expiry_date"])
                if (exp - t).days < d:  # already expired, can't sell
                    continue
                if need <= 0: break
                take = min(lot["qty_on_hand"], int(round(need)))
                lot["qty_on_hand"] -= take
                need -= take
        # waste = remaining in lots whose expiry within horizon
        waste = 0
        for lot in lots:
            exp = date.fromisoformat(lot["expiry_date"])
            if (exp - t).days < horizon:
                waste += max(0, lot["qty_on_hand"])
        return waste
    at_mean = fifo_waste(fm)
    # low demand (pessimistic sales) -> more waste; high demand -> less waste
    at_low_dem = fifo_waste(fl)
    at_high_dem = fifo_waste(fh)
    ratio = at_mean / on_hand if on_hand else 0.0
    band = "Low" if ratio < low_thr else ("Medium" if ratio < high_thr else "High")
    days_first = (min(expiries) - t).days
    daily0 = fm[0] if fm else 0.0
    # plain-language reason
    if days_first >= 0:
        shelf_note = f"First batch expires in {days_first} day(s)."
    else:
        shelf_note = f"Batches expired {-days_first} day(s) ago; remaining units are waste."
    if band == "High":
        reason = f"{at_mean} of {on_hand} units projected unsold before expiry ({ratio:.0%}). {shelf_note} Forecast daily demand ~{daily0:.1f}/day cannot clear stock in time."
    elif band=="Medium":
        reason = f"{at_mean} of {on_hand} units at risk ({ratio:.0%}). {shelf_note} Monitor; markdown or transfer may avoid waste."
    else:
        reason = f"Only {at_mean} of {on_hand} units at risk ({ratio:.0%}). {shelf_note} Stock should sell through."
    return {
        "on_hand": on_hand, "at_risk_mean": at_mean,
        "at_risk_low_demand": at_low_dem, "at_risk_high_demand": at_high_dem,
        "risk_ratio": round(ratio,4),
        "risk_range": [round(at_high_dem/max(1,on_hand),4), round(at_low_dem/max(1,on_hand),4)],
        "band": band, "reason": reason, "days_to_first_expiry": days_first,
        "thresholds": {"low": low_thr, "high": high_thr},
    }
