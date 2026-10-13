"""Spoilage Risk Agent."""
from datetime import date
from typing import Any, Dict
from app.agents.base import BaseAgent
from app.ml.risk import evaluate_spoilage_risk
from app.models.schemas import ForecastResult


class SpoilageRiskAgent(BaseAgent):
    """Agent responsible for assessing batch-level spoilage risk and time-travel simulation."""

    def __init__(self):
        super().__init__(name="SpoilageRiskAgent")

    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        batches = inputs["batches"]
        forecast_dict = inputs["forecast"]
        forecast = ForecastResult(**forecast_dict)
        as_of_date = inputs.get("as_of_date")
        if isinstance(as_of_date, str):
            as_of_date = date.fromisoformat(as_of_date)
        elif as_of_date is None:
            as_of_date = forecast.as_of_date

        day_offset = inputs.get("day_offset", 0)
        low_thresh = inputs.get("low_threshold", 0.10)
        med_thresh = inputs.get("med_threshold", 0.30)

        risk_res = evaluate_spoilage_risk(
            batches=batches,
            forecast=forecast,
            as_of_date=as_of_date,
            day_offset=day_offset,
            low_thresh=low_thresh,
            med_thresh=med_thresh,
        )
        return risk_res.model_dump(mode="json")
