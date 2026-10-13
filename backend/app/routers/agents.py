"""Agent execution, trace timeline, and counterfactual replay router."""
from datetime import date
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.agents.coordinator import CoordinatorAgent
from app.agents.demand_agent import DemandAgent
from app.agents.inventory_agent import InventoryAgent
from app.agents.recommendation_agent import RecommendationAgent
from app.agents.risk_agent import SpoilageRiskAgent
from app.auth import verify_api_key
from app.config import get_settings
from app.database import get_db_cursor
from app.models.schemas import RecommendationProposal

router = APIRouter(prefix="/api/agents", tags=["Agents"], dependencies=[Depends(verify_api_key)])


class RunAgentsRequest(BaseModel):
    store_id: int
    product_id: int
    horizon_days: int = 7


class ReplayAgentsRequest(BaseModel):
    store_id: int
    product_id: int
    hypothetical_stock: Optional[int] = None
    hypothetical_lead_time: Optional[int] = None
    hypothetical_discount: Optional[float] = None


def run_pipeline_for_item(
    store_id: int,
    product_id: int,
    horizon_days: int = 7,
    overrides: Optional[Dict[str, Any]] = None,
) -> RecommendationProposal:
    """Execute the 5 agents sequentially for a (store_id, product_id) pair."""
    settings = get_settings()
    as_of = date.fromisoformat(settings.AS_OF_DATE)
    overrides = overrides or {}

    with get_db_cursor() as cur:
        # Fetch product
        cur.execute(
            """
            SELECT id, sku, name, category, unit_cost, price, shelf_life_days,
                   unit_weight_kg, supplier_lead_time_days, min_order_qty
            FROM products WHERE id = %s;
            """,
            (product_id,),
        )
        p_row = cur.fetchone()
        if not p_row:
            raise HTTPException(status_code=404, detail="Product not found")

        product = {
            "id": p_row[0],
            "sku": p_row[1],
            "name": p_row[2],
            "category": p_row[3],
            "unit_cost": float(p_row[4]),
            "price": float(p_row[5]),
            "shelf_life_days": p_row[6],
            "unit_weight_kg": float(p_row[7]),
            "supplier_lead_time_days": overrides.get("lead_time", p_row[8]),
            "min_order_qty": p_row[9],
        }

        # Fetch active batches
        cur.execute(
            """
            SELECT id, batch_code, received_date, expiry_date, current_quantity, unit_cost
            FROM inventory_batches
            WHERE store_id = %s AND product_id = %s AND current_quantity > 0
            ORDER BY expiry_date ASC;
            """,
            (store_id, product_id),
        )
        batches = [
            {
                "id": r[0],
                "batch_code": r[1],
                "received_date": r[2],
                "expiry_date": r[3],
                "current_quantity": r[4],
                "unit_cost": float(r[5]),
            }
            for r in cur.fetchall()
        ]

        # Apply hypothetical stock override if specified
        if "stock" in overrides and batches:
            batches[0]["current_quantity"] = overrides["stock"]

        # Fetch sales history
        cur.execute(
            """
            SELECT sale_date, units_sold
            FROM sales_history
            WHERE store_id = %s AND product_id = %s AND sale_date <= %s
            ORDER BY sale_date ASC;
            """,
            (store_id, product_id, as_of),
        )
        sales = [(r[0], r[1]) for r in cur.fetchall()]

        # Transfer target candidates (other stores with low stock)
        cur.execute(
            """
            SELECT s.id, s.name, COALESCE(SUM(b.current_quantity), 0) AS other_stock
            FROM stores s
            LEFT JOIN inventory_batches b ON s.id = b.store_id AND b.product_id = %s AND b.current_quantity > 0
            WHERE s.id != %s
            GROUP BY s.id, s.name;
            """,
            (product_id, store_id),
        )
        transfer_targets = [
            {"store_id": r[0], "store_name": r[1], "quantified_need": max(0, 15 - int(r[2]))}
            for r in cur.fetchall()
        ]

    # Agent 1: Demand Forecasting
    demand_agent = DemandAgent()
    forecast_out = demand_agent.execute_and_log(
        inputs={
            "sales_series": sales,
            "horizon_days": horizon_days,
            "store_id": store_id,
            "product_id": product_id,
            "as_of_date": as_of,
        },
        store_id=store_id,
        product_id=product_id,
    )

    # Agent 2: Spoilage Risk
    risk_agent = SpoilageRiskAgent()
    risk_out = risk_agent.execute_and_log(
        inputs={
            "batches": batches,
            "forecast": forecast_out,
            "as_of_date": as_of,
            "day_offset": 0,
        },
        store_id=store_id,
        product_id=product_id,
    )

    # Agent 3: Inventory Analysis
    inv_agent = InventoryAgent()
    daily_avg = float(sum(forecast_out["point_forecast"]) / len(forecast_out["point_forecast"])) if forecast_out["point_forecast"] else 1.0
    inv_out = inv_agent.execute_and_log(
        inputs={
            "on_hand_units": risk_out["on_hand_units"],
            "daily_forecast_avg": daily_avg,
            "supplier_lead_time_days": product["supplier_lead_time_days"],
            "min_order_qty": product["min_order_qty"],
        },
        store_id=store_id,
        product_id=product_id,
    )

    # Agent 4: Action Recommendation
    rec_agent = RecommendationAgent()
    rec_out = rec_agent.execute_and_log(
        inputs={
            "store_id": store_id,
            "product": product,
            "on_hand_units": risk_out["on_hand_units"],
            "at_risk_units": risk_out["at_risk_units"],
            "risk_level": risk_out["risk_level"],
            "forecast_daily_avg": daily_avg,
            "inventory_analysis": inv_out,
            "transfer_targets": transfer_targets,
            "active_batches": batches,
            "as_of_date": as_of,
        },
        store_id=store_id,
        product_id=product_id,
    )

    # Agent 5: Coordinator
    coord_agent = CoordinatorAgent()
    coord_out = coord_agent.execute_and_log(
        inputs={
            "store_id": store_id,
            "product_id": product_id,
            "on_hand_units": risk_out["on_hand_units"],
            "at_risk_units": risk_out["at_risk_units"],
            "risk_level": risk_out["risk_level"],
            "risk_ratio": risk_out["risk_ratio"],
            "forecast_demand": round(float(sum(forecast_out["point_forecast"])), 2),
            "options": rec_out["options"],
            "product": product,
        },
        store_id=store_id,
        product_id=product_id,
    )

    proposal = RecommendationProposal(**coord_out)

    # Persist recommendation into database
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO recommendations (
                store_id, product_id, proposed_action, proposed_quantity, current_stock,
                forecast_demand, risk_level, risk_ratio, expected_loss, waste_avoided_kg,
                cost_impact, alternatives_json, explanation, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                proposal.store_id,
                proposal.product_id,
                proposal.proposed_action,
                proposal.proposed_quantity,
                proposal.current_stock,
                proposal.forecast_demand,
                proposal.risk_level,
                proposal.risk_ratio,
                proposal.expected_loss,
                proposal.waste_avoided_kg,
                proposal.cost_impact,
                json.dumps([opt.model_dump() for opt in proposal.alternatives], default=str),
                proposal.explanation,
                "pending",
            ),
        )
        rec_id = cur.fetchone()[0]
        proposal.id = rec_id

    return proposal


@router.post("/run", response_model=RecommendationProposal)
def run_agents(req: RunAgentsRequest):
    """Run full 5-agent pipeline for a single store/SKU pair."""
    return run_pipeline_for_item(req.store_id, req.product_id, req.horizon_days)


@router.post("/run-all")
def run_all_agents():
    """Run the 5-agent pipeline across all store and SKU combinations."""
    with get_db_cursor() as cur:
        cur.execute("SELECT DISTINCT store_id, product_id FROM inventory_batches WHERE current_quantity > 0;")
        pairs = cur.fetchall()

    proposals = []
    for s_id, p_id in pairs:
        try:
            p = run_pipeline_for_item(s_id, p_id)
            proposals.append(p.model_dump())
        except Exception:
            pass

    return {"count": len(proposals), "proposals": proposals}


@router.get("/trace")
def get_agent_traces(limit: int = Query(default=30, ge=1, le=100)):
    """Retrieve chronologically ordered execution traces of recent agent runs."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT id, run_timestamp, store_id, product_id, agent_name,
                   inputs_json, outputs_json, execution_time_ms, validation_passed, error_message
            FROM agent_runs
            ORDER BY run_timestamp DESC
            LIMIT %s;
            """,
            (limit,),
        )
        traces = [
            {
                "id": r[0],
                "run_timestamp": r[1].isoformat(),
                "store_id": r[2],
                "product_id": r[3],
                "agent_name": r[4],
                "inputs": r[5],
                "outputs": r[6],
                "execution_time_ms": float(r[7]),
                "validation_passed": r[8],
                "error_message": r[9],
            }
            for r in cur.fetchall()
        ]

    return {"count": len(traces), "traces": traces}


@router.post("/replay")
def replay_counterfactual(req: ReplayAgentsRequest):
    """Counterfactual replay: Re-runs the agent pipeline under hypothetical parameters and diffs proposals."""
    baseline = run_pipeline_for_item(req.store_id, req.product_id)

    overrides = {}
    if req.hypothetical_stock is not None:
        overrides["stock"] = req.hypothetical_stock
    if req.hypothetical_lead_time is not None:
        overrides["lead_time"] = req.hypothetical_lead_time

    counterfactual = run_pipeline_for_item(req.store_id, req.product_id, overrides=overrides)

    diff = {
        "baseline_action": baseline.proposed_action,
        "baseline_quantity": baseline.proposed_quantity,
        "baseline_expected_loss": baseline.expected_loss,
        "counterfactual_action": counterfactual.proposed_action,
        "counterfactual_quantity": counterfactual.proposed_quantity,
        "counterfactual_expected_loss": counterfactual.expected_loss,
        "action_changed": baseline.proposed_action != counterfactual.proposed_action,
        "loss_delta": round(counterfactual.expected_loss - baseline.expected_loss, 2),
    }

    return {
        "baseline": baseline.model_dump(),
        "counterfactual": counterfactual.model_dump(),
        "diff": diff,
    }
