"""Inventory Analysis Agent."""
from typing import Any, Dict
from app.agents.base import BaseAgent


class InventoryAgent(BaseAgent):
    """Agent evaluating inventory health, lead-time coverage, and days-of-supply."""

    def __init__(self):
        super().__init__(name="InventoryAnalysisAgent")

    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        on_hand_units = int(inputs["on_hand_units"])
        daily_forecast_avg = float(inputs.get("daily_forecast_avg", 1.0))
        lead_time_days = int(inputs.get("supplier_lead_time_days", 2))
        min_order_qty = int(inputs.get("min_order_qty", 10))

        # Days of supply
        days_of_supply = round(on_hand_units / daily_forecast_avg, 2) if daily_forecast_avg > 0 else 999.0

        # Safety threshold: lead time + 2 days buffer
        reorder_point = int(round(daily_forecast_avg * (lead_time_days + 2)))
        target_stock = int(round(daily_forecast_avg * (lead_time_days + 5)))

        is_understock = on_hand_units <= reorder_point
        is_overstock = days_of_supply > 14.0

        suggested_replenish_qty = 0
        if is_understock:
            needed = target_stock - on_hand_units
            suggested_replenish_qty = max(min_order_qty, needed)

        return {
            "on_hand_units": on_hand_units,
            "days_of_supply": days_of_supply,
            "reorder_point": reorder_point,
            "target_stock": target_stock,
            "is_understock": is_understock,
            "is_overstock": is_overstock,
            "suggested_replenish_qty": suggested_replenish_qty,
        }
