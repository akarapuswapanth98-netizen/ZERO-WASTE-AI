"""Scenario simulator router."""
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.auth import verify_api_key
from app.database import get_db_cursor
from app.models.schemas import ScenarioRunResult
from app.simulation.scenario_engine import PRESETS, run_multi_seed_scenario

router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"], dependencies=[Depends(verify_api_key)])


class RunScenarioRequest(BaseModel):
    preset_name: str = "demand_spike"
    seeds_count: int = 5
    horizon_days: int = 14
    store_id: Optional[int] = 1
    product_id: Optional[int] = 1


@router.get("/presets")
def get_scenario_presets():
    """Retrieve available scenario presets and their parameter perturbations."""
    descriptions = {
        "demand_spike": "+40% demand surge across consecutive days.",
        "supplier_delay": "+4 days supplier lead time delay.",
        "shorter_shelf_life": "-30% batch shelf life on receipt.",
        "promotional_markdown": "Competitor promotion drops baseline sales by 25%.",
        "excess_inventory": "+50% initial batch overstock.",
        "store_variance": "High demand volatility across stores (+50% noise).",
    }
    return {
        "presets": [
            {
                "id": k,
                "name": k.replace("_", " ").title(),
                "description": descriptions.get(k, ""),
                "parameters": v,
            }
            for k, v in PRESETS.items()
        ]
    }


@router.post("/run", response_model=ScenarioRunResult)
def execute_scenario_run(req: RunScenarioRequest):
    """Execute seeded scenario simulation across FIFO, Fixed-threshold, and Agentic policies on identical inputs."""
    res = run_multi_seed_scenario(
        preset_name=req.preset_name,
        seeds_count=req.seeds_count,
        horizon_days=req.horizon_days,
    )

    # Persist scenario run into scenario_runs table
    try:
        with get_db_cursor() as cur:
            for p_res in res.policy_results:
                cur.execute(
                    """
                    INSERT INTO scenario_runs (preset_name, seed, horizon_days, policy_name, metrics_json)
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    (
                        req.preset_name,
                        req.seeds_count,
                        req.horizon_days,
                        p_res["policy_name"],
                        json.dumps(p_res),
                    ),
                )
    except Exception:
        pass

    return res
