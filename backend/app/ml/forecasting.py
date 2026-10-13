"""Mathematical perishable demand forecasting engine (NumPy only)."""
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
import numpy as np
from app.models.schemas import CandidateForecastMetric, ForecastResult

MODEL_SEASONAL_NAIVE = "seasonal_naive"
MODEL_MOVING_AVERAGE = "moving_average_7d"
MODEL_SES = "simple_exponential_smoothing"


def fit_predict_seasonal_naive(train: np.ndarray, horizon: int) -> np.ndarray:
    """Seasonal naive forecast using 7-day lag: y_t = y_{t-7}."""
    if len(train) < 7:
        val = float(np.mean(train)) if len(train) > 0 else 0.0
        return np.full(horizon, val)
    preds = np.zeros(horizon)
    for h in range(horizon):
        lag_idx = -(7 - (h % 7))
        preds[h] = train[lag_idx]
    return np.maximum(0.0, preds)


def fit_predict_moving_average_7d(train: np.ndarray, horizon: int) -> np.ndarray:
    """7-day rolling moving average forecast."""
    if len(train) == 0:
        return np.zeros(horizon)
    window = min(7, len(train))
    mean_val = float(np.mean(train[-window:]))
    return np.full(horizon, max(0.0, mean_val))


def fit_predict_ses(train: np.ndarray, horizon: int) -> Tuple[np.ndarray, float]:
    """Simple Exponential Smoothing with alpha grid search [0.1, 0.9]."""
    if len(train) == 0:
        return np.zeros(horizon), 0.3
    if len(train) == 1:
        return np.full(horizon, float(train[0])), 0.3

    best_alpha = 0.3
    best_sse = float("inf")
    alphas = np.linspace(0.1, 0.9, 9)

    for alpha in alphas:
        level = float(train[0])
        sse = 0.0
        for y in train[1:]:
            pred = level
            sse += (y - pred) ** 2
            level = alpha * y + (1 - alpha) * level
        if sse < best_sse:
            best_sse = sse
            best_alpha = float(alpha)

    # Compute final level
    level = float(train[0])
    for y in train[1:]:
        level = best_alpha * y + (1 - best_alpha) * level

    return np.full(horizon, max(0.0, level)), best_alpha


def compute_metrics(actual: np.ndarray, pred: np.ndarray) -> Tuple[float, float]:
    """Compute MAE and WAPE on held-out window."""
    if len(actual) == 0:
        return 0.0, 0.0
    errors = np.abs(actual - pred)
    mae = float(np.mean(errors))
    sum_actual = float(np.sum(actual))
    wape = float(np.sum(errors) / sum_actual) if sum_actual > 0 else (0.0 if mae == 0 else 1.0)
    return round(mae, 3), round(wape, 4)


def run_forecasting_pipeline(
    sales_series: List[Tuple[date, int]],
    horizon_days: int = 7,
    store_id: int = 1,
    product_id: int = 1,
    as_of_date: Optional[date] = None,
) -> ForecastResult:
    """Evaluate 3 candidate models on held-out 7 days, pick winner, and forecast future horizon."""
    if not sales_series:
        ref_date = as_of_date or date.today()
        dates = [ref_date + timedelta(days=i) for i in range(horizon_days)]
        return ForecastResult(
            store_id=store_id,
            product_id=product_id,
            as_of_date=ref_date,
            horizon_days=horizon_days,
            candidate_metrics=[
                CandidateForecastMetric(model_name=m, mae=0.0, wape=0.0, is_winner=(m == MODEL_SEASONAL_NAIVE))
                for m in [MODEL_SEASONAL_NAIVE, MODEL_MOVING_AVERAGE, MODEL_SES]
            ],
            winner_model=MODEL_SEASONAL_NAIVE,
            is_tie=True,
            point_forecast=[0.0] * horizon_days,
            lower_bound=[0.0] * horizon_days,
            upper_bound=[0.0] * horizon_days,
            forecast_dates=dates,
        )

    # Sort sales series by date
    sorted_sales = sorted(sales_series, key=lambda x: x[0])
    y_values = np.array([float(x[1]) for x in sorted_sales], dtype=float)
    dates_list = [x[0] for x in sorted_sales]
    last_hist_date = dates_list[-1]
    ref_date = as_of_date or (last_hist_date + timedelta(days=1))

    # Held-out protocol: final 7 days as test set
    held_out_len = 7
    if len(y_values) > held_out_len + 7:
        train_y = y_values[:-held_out_len]
        test_y = y_values[-held_out_len:]
    else:
        # Fallback if series is short
        split = max(1, int(len(y_values) * 0.8))
        train_y = y_values[:split]
        test_y = y_values[split:]
        held_out_len = len(test_y)

    # 1. Seasonal-Naive on held-out
    sn_test_pred = fit_predict_seasonal_naive(train_y, held_out_len)
    sn_mae, sn_wape = compute_metrics(test_y, sn_test_pred)

    # 2. Moving Average on held-out
    ma_test_pred = fit_predict_moving_average_7d(train_y, held_out_len)
    ma_mae, ma_wape = compute_metrics(test_y, ma_test_pred)

    # 3. SES on held-out
    ses_test_pred, _ = fit_predict_ses(train_y, held_out_len)
    ses_mae, ses_wape = compute_metrics(test_y, ses_test_pred)

    candidates = [
        {"name": MODEL_SEASONAL_NAIVE, "mae": sn_mae, "wape": sn_wape, "test_pred": sn_test_pred},
        {"name": MODEL_MOVING_AVERAGE, "mae": ma_mae, "wape": ma_wape, "test_pred": ma_test_pred},
        {"name": MODEL_SES, "mae": ses_mae, "wape": ses_wape, "test_pred": ses_test_pred},
    ]

    # Select winner by minimum WAPE, then minimum MAE
    sorted_candidates = sorted(candidates, key=lambda c: (c["wape"], c["mae"]))
    winner = sorted_candidates[0]
    runner_up = sorted_candidates[1]
    is_tie = abs(winner["wape"] - runner_up["wape"]) < 0.001

    candidate_metrics = [
        CandidateForecastMetric(
            model_name=c["name"],
            mae=c["mae"],
            wape=c["wape"],
            is_winner=(c["name"] == winner["name"]),
        )
        for c in candidates
    ]

    # Fit winner on ALL data to forecast future horizon
    winner_name = winner["name"]
    if winner_name == MODEL_SEASONAL_NAIVE:
        point_forecast = fit_predict_seasonal_naive(y_values, horizon_days)
    elif winner_name == MODEL_MOVING_AVERAGE:
        point_forecast = fit_predict_moving_average_7d(y_values, horizon_days)
    else:
        point_forecast, _ = fit_predict_ses(y_values, horizon_days)

    # Prediction intervals from winner's held-out residuals
    residuals = test_y - winner["test_pred"]
    if len(residuals) > 1:
        res_std = float(np.std(residuals, ddof=1))
    else:
        res_std = 1.0
    # 80% prediction interval (z = 1.28)
    z_score = 1.28
    lower_bound = np.maximum(0.0, point_forecast - z_score * res_std)
    upper_bound = np.maximum(0.0, point_forecast + z_score * res_std)

    forecast_dates = [ref_date + timedelta(days=i) for i in range(horizon_days)]

    return ForecastResult(
        store_id=store_id,
        product_id=product_id,
        as_of_date=ref_date,
        horizon_days=horizon_days,
        candidate_metrics=candidate_metrics,
        winner_model=winner_name,
        is_tie=is_tie,
        point_forecast=[round(float(p), 2) for p in point_forecast],
        lower_bound=[round(float(p), 2) for p in lower_bound],
        upper_bound=[round(float(p), 2) for p in upper_bound],
        forecast_dates=forecast_dates,
    )
