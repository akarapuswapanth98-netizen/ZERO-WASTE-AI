"""Tests for spoilage risk evaluation, FIFO consumption, and time-travel offset."""
from datetime import date, timedelta
from app.ml.risk import evaluate_spoilage_risk, fifo_simulate_consumption
from app.models.schemas import CandidateForecastMetric, ForecastResult


def make_dummy_forecast(as_of: date, point: list, lower: list, upper: list) -> ForecastResult:
    return ForecastResult(
        store_id=1,
        product_id=1,
        as_of_date=as_of,
        horizon_days=len(point),
        candidate_metrics=[
            CandidateForecastMetric(model_name="seasonal_naive", mae=1.0, wape=0.1, is_winner=True)
        ],
        winner_model="seasonal_naive",
        is_tie=False,
        point_forecast=point,
        lower_bound=lower,
        upper_bound=upper,
        forecast_dates=[as_of + timedelta(days=i) for i in range(len(point))],
    )


def test_fifo_consumption_and_unsold_waste():
    """Verify batches are consumed in order of expiry date, and expired units are counted."""
    as_of = date(2026, 10, 12)
    batches = [
        # Batch 1 expires in 2 days (40 units)
        {"id": 1, "batch_code": "B1", "expiry_date": as_of + timedelta(days=2), "current_quantity": 40, "unit_cost": 2.0},
        # Batch 2 expires in 6 days (50 units)
        {"id": 2, "batch_code": "B2", "expiry_date": as_of + timedelta(days=6), "current_quantity": 50, "unit_cost": 2.0},
    ]

    # Daily demand = 10 units/day for 7 days
    # In 2 days, only 20 units consumed from B1 -> 20 units expire unsold!
    daily_demands = [10.0] * 7
    unsold, sim_batches = fifo_simulate_consumption(batches, daily_demands, as_of)

    assert unsold == 20
    b1_sim = next(b for b in sim_batches if b["batch_code"] == "B1")
    b2_sim = next(b for b in sim_batches if b["batch_code"] == "B2")
    assert b1_sim["expired_unsold"] == 10
    assert b2_sim["expired_unsold"] == 10


def test_spoilage_risk_classification_and_ranges():
    """Verify risk ratio, Low/Medium/High classification, and interval range ordering."""
    as_of = date(2026, 10, 12)
    # Total on-hand = 100 units
    batches = [
        {"id": 1, "batch_code": "B1", "expiry_date": as_of + timedelta(days=2), "current_quantity": 50, "unit_cost": 2.0},
        {"id": 2, "batch_code": "B2", "expiry_date": as_of + timedelta(days=7), "current_quantity": 50, "unit_cost": 2.0},
    ]

    # Demand: Point = 10/day, Lower = 5/day, Upper = 15/day
    fc = make_dummy_forecast(
        as_of=as_of,
        point=[10.0] * 7,
        lower=[5.0] * 7,
        upper=[15.0] * 7,
    )

    res = evaluate_spoilage_risk(batches=batches, forecast=fc, as_of_date=as_of)

    assert res.on_hand_units == 100
    # In 2 days: point demand is 20 -> 30 units at risk from B1. 30/100 = 30% -> High risk
    assert res.at_risk_units == 30
    assert res.risk_ratio == 0.30
    assert res.risk_level == "High"

    # Invariant: min <= point <= max for at-risk units
    assert res.at_risk_range_min <= res.at_risk_units <= res.at_risk_range_max
    assert "at risk of spoilage" in res.reason


def test_time_travel_day_offset_recalculation():
    """Verify day_offset > 0 recomputes spoilage risk based on shifted elapsed dates."""
    as_of = date(2026, 10, 12)
    batches = [
        {"id": 1, "batch_code": "B1", "expiry_date": as_of + timedelta(days=3), "current_quantity": 30, "unit_cost": 2.0},
    ]
    fc = make_dummy_forecast(
        as_of=as_of,
        point=[10.0] * 7,
        lower=[10.0] * 7,
        upper=[10.0] * 7,
    )

    # Offset 0: 3 days to expiry, 30 demand -> 0 at risk
    res_0 = evaluate_spoilage_risk(batches=batches, forecast=fc, as_of_date=as_of, day_offset=0)
    assert res_0.at_risk_units == 0

    # Offset 2: advance 2 days -> only 1 day left to expiry, 20 demand across days -> 10 at risk!
    res_2 = evaluate_spoilage_risk(batches=batches, forecast=fc, as_of_date=as_of, day_offset=2)
    assert res_2.at_risk_units == 10
    assert res_2.risk_level == "High"
