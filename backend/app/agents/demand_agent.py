"""Demand Forecasting Agent."""
from datetime import date
from typing import Any, Dict, List, Tuple
from app.agents.base import BaseAgent
from app.ml.forecasting import run_forecasting_pipeline


class DemandAgent(BaseAgent):
    """Agent responsible for perishable demand forecasting across candidate models."""

    def __init__(self):
        super().__init__(name="DemandForecastingAgent")

    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        sales_records = inputs["sales_series"]  # List of (date, units_sold)
        horizon_days = inputs.get("horizon_days", 7)
        store_id = inputs.get("store_id", 1)
        product_id = inputs.get("product_id", 1)
        as_of_date = inputs.get("as_of_date")

        res = run_forecasting_pipeline(
            sales_series=sales_records,
            horizon_days=horizon_days,
            store_id=store_id,
            product_id=product_id,
            as_of_date=as_of_date,
        )
        return res.model_dump(mode="json")
