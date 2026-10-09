"""Demand forecasting: exponential smoothing vs 7-day MA baseline vs seasonal-naive,
held-out 7d MAE/WAPE, residual intervals. SES remains the engine model; the page reports all three honestly."""
from __future__ import annotations
import time
from datetime import date, timedelta
import numpy as np

def ses_fit_forecast(train: list[float], alpha: float = 0.4, horizon: int = 7) -> list[float]:
    if not train: return [0.0]*horizon
    level = float(train[0])
    for x in train[1:]:
        level = alpha*float(x) + (1-alpha)*level
    return [round(level, 2)]*horizon

def ma_forecast(train: list[float], window: int = 7, horizon: int = 7) -> list[float]:
    if not train: return [0.0]*horizon
    v = float(np.mean(train[-window:])) if len(train)>=1 else 0.0
    return [round(v,2)]*horizon

def mae(a, f) -> float:
    a=np.array(a,float); f=np.array(f,float)
    return round(float(np.mean(np.abs(a-f))),3) if len(a) else 0.0

def wape(a, f) -> float:
    a=np.array(a,float); f=np.array(f,float)
    d=float(np.sum(np.abs(a)))
    return round(float(np.sum(np.abs(a-f))/d),4) if d>0 else 0.0

def seasonal_naive(train_dates: list[str], train_vals: list[float], steps: int) -> list[float]:
    """Same-weekday historical mean; falls back to overall mean for unseen weekdays."""
    by_wd: dict[int, list[float]] = {}
    for d, v in zip(train_dates, train_vals):
        try:
            by_wd.setdefault(date.fromisoformat(d).weekday(), []).append(float(v))
        except ValueError:
            continue
    means = {k: sum(v) / len(v) for k, v in by_wd.items()}
    overall = float(np.mean(train_vals)) if train_vals else 0.0
    try:
        last = date.fromisoformat(train_dates[-1]) if train_dates else date.today()
    except (ValueError, IndexError):
        last = date.today()
    return [round(means.get((last + timedelta(days=i + 1)).weekday(), overall), 2) for i in range(steps)]

def forecast_series(dates: list[str], values: list[float], horizon: int = 7, alpha: float = 0.4) -> dict:
    """Engine forecast = held-out winner per series (SES stays available and reported).
    Split last 7 as held-out; train on rest."""
    t0=time.time()
    n=len(values)
    if n < 14:
        train, test = values, []
    else:
        train, test = values[:-7], values[-7:]
    train_dates = dates[:len(train)] if len(dates) >= len(train) else dates
    ses_h = ses_fit_forecast(train, alpha, horizon)
    ma_h = ma_forecast(train, 7, horizon)
    seas_h = seasonal_naive(train_dates, train, horizon)
    if test:
        level = float(train[0]) if train else 0.0
        for x in train[1:]:
            level = alpha*float(x)+(1-alpha)*level
        ma_v = float(np.mean(train[-7:])) if train else 0.0
        seas_test = seasonal_naive(train_dates, train, len(test))
        preds = {"SES": [level]*len(test),
                 "7-day MA": [ma_v]*len(test),
                 "seasonal-naive": seas_test}
        scored = {k: (mae(test, p), wape(test, p)) for k, p in preds.items()}
        winner = min(scored, key=lambda k: scored[k][0])
        resid = {k: [float(a)-pp for a, pp in zip(test, p)] for k, p in preds.items()}
        stds = {k: (float(np.std(r)) if len(r) > 1 else 0.0) for k, r in resid.items()}
    else:
        preds = {}
        scored = {"SES": (0.0, 0.0), "7-day MA": (0.0, 0.0), "seasonal-naive": (0.0, 0.0)}
        winner = "SES"
        stds = {"SES": 1.0, "7-day MA": 1.0, "seasonal-naive": 1.0}
    engine_h = {"SES": ses_h, "7-day MA": ma_h, "seasonal-naive": seas_h}[winner]
    std = stds[winner]
    ses_mae, ses_wape = scored["SES"]
    ma_mae, ma_wape = scored["7-day MA"]
    seas_mae, seas_wape = scored["seasonal-naive"]
    z = 1.28  # 80% interval from the WINNER's held-out residuals
    low = [round(max(0,x - z*std),2) for x in engine_h]
    high = [round(x + z*std,2) for x in engine_h]
    beats = ses_mae < ma_mae if test else False
    return {
        "history_dates": dates, "history_values": values,
        "train_len": len(train), "test_len": len(test), "test_values": test,
        "test_models": {"ses": [round(v,2) for v in preds.get("SES", [])],
                        "ma": [round(v,2) for v in preds.get("7-day MA", [])],
                        "seasonal": [round(v,2) for v in preds.get("seasonal-naive", [])]},
        "forecast_mean": engine_h, "forecast_low": low, "forecast_high": high,
        "baseline_forecast": ma_h, "seasonal_forecast": seas_h,
        "model": {"name":"exponential_smoothing","alpha":alpha,"mae":ses_mae,"wape":ses_wape},
        "baseline": {"name":"moving_avg_7d","mae":ma_mae,"wape":ma_wape},
        "seasonal": {"name":"seasonal_naive_weekday","mae":seas_mae,"wape":seas_wape},
        "winner": winner, "engine": winner,
        "residual_std": round(std,3), "interval_z": z, "interval_label":f"80% from {winner} held-out residuals",
        "beats_baseline": beats,
        "honesty_note": ("SES beats 7-day MA on held-out 7d." if beats else "SES does not clearly beat the baseline on the held-out 7 days.")
                        + (f" Engine for this series: {winner} (lowest held-out MAE)." if test else ""),
        "duration_ms": int((time.time()-t0)*1000),
    }
