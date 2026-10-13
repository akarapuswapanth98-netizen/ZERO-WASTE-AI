"""Spoilage risk assessment engine with FIFO batch consumption and time-travel support."""
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
from app.models.schemas import ForecastResult, SpoilageRiskResult


def fifo_simulate_consumption(
    batches: List[Dict[str, Any]],
    daily_demands: List[float],
    as_of: date,
) -> Tuple[int, List[Dict[str, Any]]]:
    """FIFO consume batches against daily demands over time to find unsold expired units."""
    # Deep copy active batch representations
    sim_batches = [
        {
            "id": b.get("id", 0),
            "batch_code": b["batch_code"],
            "expiry_date": b["expiry_date"],
            "remaining_qty": int(b["current_quantity"]),
            "unit_cost": float(b["unit_cost"]),
            "expired_unsold": 0,
        }
        for b in sorted(batches, key=lambda x: x["expiry_date"])
        if b["current_quantity"] > 0
    ]

    total_days = len(daily_demands)

    for day_idx in range(total_days):
        current_day = as_of + timedelta(days=day_idx)
        demand_today = float(daily_demands[day_idx])

        # 1. First, expire batches whose expiry date is strictly before current_day
        for b in sim_batches:
            if b["expiry_date"] < current_day and b["remaining_qty"] > 0:
                b["expired_unsold"] += b["remaining_qty"]
                b["remaining_qty"] = 0

        # 2. FIFO consume remaining demand from valid batches
        rem_demand = demand_today
        for b in sim_batches:
            if rem_demand <= 0:
                break
            if b["expiry_date"] >= current_day and b["remaining_qty"] > 0:
                consume = min(b["remaining_qty"], rem_demand)
                b["remaining_qty"] -= int(round(consume))
                rem_demand -= consume

    # Final check on or past horizon end: any batch whose expiry_date <= as_of + total_days
    cutoff_date = as_of + timedelta(days=total_days)
    for b in sim_batches:
        if b["expiry_date"] <= cutoff_date and b["remaining_qty"] > 0:
            b["expired_unsold"] += b["remaining_qty"]
            b["remaining_qty"] = 0

    total_unsold = sum(b["expired_unsold"] for b in sim_batches)
    return total_unsold, sim_batches


def evaluate_spoilage_risk(
    batches: List[Dict[str, Any]],
    forecast: ForecastResult,
    as_of_date: date,
    day_offset: int = 0,
    low_thresh: float = 0.10,
    med_thresh: float = 0.30,
) -> SpoilageRiskResult:
    """Compute spoilage risk ratio, interval range, and plain-language explanation."""
    # Apply time-travel day offset
    effective_as_of = as_of_date + timedelta(days=day_offset)

    # Shift forecast if day_offset > 0
    if day_offset > 0 and len(forecast.point_forecast) > day_offset:
        shifted_point = forecast.point_forecast[day_offset:]
        shifted_lower = forecast.lower_bound[day_offset:]
        shifted_upper = forecast.upper_bound[day_offset:]
    else:
        shifted_point = forecast.point_forecast
        shifted_lower = forecast.lower_bound
        shifted_upper = forecast.upper_bound

    # Current on-hand stock
    active_batches = [b for b in batches if b["current_quantity"] > 0 and b["expiry_date"] >= effective_as_of]
    on_hand = sum(b["current_quantity"] for b in active_batches)

    if on_hand == 0:
        return SpoilageRiskResult(
            store_id=forecast.store_id,
            product_id=forecast.product_id,
            as_of_date=effective_as_of,
            on_hand_units=0,
            at_risk_units=0,
            risk_ratio=0.0,
            risk_level="Low",
            at_risk_range_min=0,
            at_risk_range_max=0,
            reason="No inventory on hand. Spoilage risk is zero.",
            batch_breakdown=[],
        )

    # Expected point simulation
    at_risk_point, breakdown = fifo_simulate_consumption(active_batches, shifted_point, effective_as_of)

    # Upper bound demand -> lowest spoilage risk
    at_risk_min, _ = fifo_simulate_consumption(active_batches, shifted_upper, effective_as_of)

    # Lower bound demand -> highest spoilage risk
    at_risk_max, _ = fifo_simulate_consumption(active_batches, shifted_lower, effective_as_of)

    # Ensure logical order
    at_risk_min = min(at_risk_min, at_risk_point)
    at_risk_max = max(at_risk_max, at_risk_point)

    risk_ratio = round(at_risk_point / on_hand, 4) if on_hand > 0 else 0.0

    if risk_ratio < low_thresh:
        risk_level = "Low"
    elif risk_ratio < med_thresh:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # Plain-language reason generation
    soon_batches = [
        b for b in sorted(active_batches, key=lambda x: x["expiry_date"])
        if (b["expiry_date"] - effective_as_of).days <= 3
    ]
    if at_risk_point == 0:
        reason = f"All {on_hand} on-hand units projected to sell comfortably before expiration."
    elif soon_batches:
        nearest_batch = soon_batches[0]
        days_left = (nearest_batch["expiry_date"] - effective_as_of).days
        reason = (
            f"Batch {nearest_batch['batch_code']} ({nearest_batch['current_quantity']} units) "
            f"expires in {max(0, days_left)} days. Projected demand is insufficient, "
            f"leaving {at_risk_point} units (range {at_risk_min}-{at_risk_max}) at risk of spoilage."
        )
    else:
        reason = (
            f"Projected demand falls short of stock across horizon, leaving {at_risk_point} "
            f"units ({round(risk_ratio * 100, 1)}% of inventory) at risk."
        )

    return SpoilageRiskResult(
        store_id=forecast.store_id,
        product_id=forecast.product_id,
        as_of_date=effective_as_of,
        on_hand_units=on_hand,
        at_risk_units=at_risk_point,
        risk_ratio=risk_ratio,
        risk_level=risk_level,
        at_risk_range_min=at_risk_min,
        at_risk_range_max=at_risk_max,
        reason=reason,
        batch_breakdown=breakdown,
    )
