"""Tests for mathematical forecasting algorithms, held-out evaluation, and prediction intervals."""
from datetime import date, timedelta
import numpy as np
from app.ml.forecasting import (
    MODEL_MOVING_AVERAGE,
    MODEL_SEASONAL_NAIVE,
    MODEL_SES,
    compute_metrics,
    fit_predict_moving_average_7d,
    fit_predict_seasonal_naive,
    fit_predict_ses,
    run_forecasting_pipeline,
)


def test_seasonal_naive_forecasting():
    """Verify seasonal naive forecasts the 7-day lag cycle correctly."""
    # 14 days of repeating cycle 1..7
    cycle = np.array([10, 12, 14, 16, 20, 25, 22, 10, 12, 14, 16, 20, 25, 22], dtype=float)
    preds = fit_predict_seasonal_naive(cycle, horizon=7)
    assert len(preds) == 7
    # Future 7 days should match the last 7 days exactly
    np.testing.assert_array_almost_equal(preds, cycle[-7:])


def test_moving_average_forecasting():
    """Verify 7-day moving average outputs the mean of the last 7 days."""
    arr = np.array([10, 10, 10, 20, 20, 20, 30], dtype=float)
    expected_mean = np.mean(arr[-7:])
    preds = fit_predict_moving_average_7d(arr, horizon=5)
    assert len(preds) == 5
    assert np.allclose(preds, expected_mean)


def test_ses_forecasting_and_alpha_optimization():
    """Verify Simple Exponential Smoothing finds an optimal alpha and forecasts level."""
    arr = np.array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14], dtype=float)
    preds, alpha = fit_predict_ses(arr, horizon=4)
    assert len(preds) == 4
    assert 0.1 <= alpha <= 0.9
    assert np.all(preds > 0)


def test_compute_metrics_mae_wape():
    """Verify MAE and WAPE computations match analytical formulas."""
    actual = np.array([10.0, 20.0, 30.0])
    pred = np.array([12.0, 18.0, 33.0])
    # Errors: [2, 2, 3] -> sum = 7, mean = 7/3 = 2.333
    # Actual sum = 60 -> WAPE = 7/60 = 0.1167
    mae, wape = compute_metrics(actual, pred)
    assert mae == round(7 / 3, 3)
    assert wape == round(7 / 60, 4)


def test_forecasting_pipeline_winner_selection_and_intervals():
    """Verify the full pipeline evaluates all 3 models, chooses the winner, and calculates intervals."""
    as_of = date(2026, 10, 12)
    # Generate 84 days of synthetic sales with a clear weekly pattern (seasonal naive should win)
    sales_series = []
    for i in range(84):
        d = as_of - timedelta(days=84 - i)
        val = 15 + (10 if d.weekday() in (4, 5) else 0)  # Weekend surge
        sales_series.append((d, val))

    res = run_forecasting_pipeline(sales_series=sales_series, horizon_days=7, as_of_date=as_of)

    assert len(res.candidate_metrics) == 3
    model_names = {m.model_name for m in res.candidate_metrics}
    assert model_names == {MODEL_SEASONAL_NAIVE, MODEL_MOVING_AVERAGE, MODEL_SES}

    assert res.winner_model in model_names
    assert len(res.point_forecast) == 7
    assert len(res.lower_bound) == 7
    assert len(res.upper_bound) == 7

    # Prediction interval invariant: lower_bound <= point_forecast <= upper_bound
    for low, point, up in zip(res.lower_bound, res.point_forecast, res.upper_bound):
        assert low >= 0.0
        assert low <= point <= up
