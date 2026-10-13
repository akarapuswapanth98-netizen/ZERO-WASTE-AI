"""Evaluation and baseline comparison router with CSV export."""
import csv
from io import StringIO
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Response
from app.auth import verify_api_key
from app.database import get_db_cursor
from app.simulation.scenario_engine import run_multi_seed_scenario

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation"], dependencies=[Depends(verify_api_key)])


@router.get("")
def get_evaluation_metrics():
    """Retrieve aggregate evaluation comparisons, formulas, assumptions, and baseline benchmarking."""
    # Run a canonical evaluation scenario if not yet populated
    sim_res = run_multi_seed_scenario(preset_name="demand_spike", seeds_count=5, horizon_days=14)

    formulas = {
        "MAE": "Mean Absolute Error: (1/n) * sum(|actual - pred|)",
        "WAPE": "Weighted Absolute Percentage Error: sum(|actual - pred|) / sum(actual)",
        "Expected Loss": "waste_cost + markdown_giveaway + transfer_cost + stockout_penalty - salvage_recovery",
        "CO2e Saved": "waste_avoided_kg * 2.5 kg CO2e/kg (FAO food waste benchmark)",
    }

    assumptions = [
        "Price elasticity for perishable markdown discounts: E = 1.5",
        "Donation salvage CSR / tax recovery credit: 20% of unit cost",
        "Inter-store freight and handling cost: $0.50 per unit",
        "Replenishment procurement fixed admin cost: $15.00 per order",
        "Emission factor: 2.50 kg CO2e per kg food waste avoided",
    ]

    return {
        "evaluation_period_days": 14,
        "sample_size_seeds": sim_res.seeds_run,
        "formulas": formulas,
        "modelling_assumptions": assumptions,
        "benchmark_policies": sim_res.policy_results,
    }


@router.get("/export-csv")
def export_evaluation_csv():
    """Export benchmark policy comparison data as CSV."""
    sim_res = run_multi_seed_scenario(preset_name="demand_spike", seeds_count=5, horizon_days=14)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Policy Name",
        "Waste Units (Mean)",
        "Waste Units (Min)",
        "Waste Units (Max)",
        "Waste Cost ($ Mean)",
        "Stockout Units (Mean)",
        "Service Level % (Mean)",
        "Net Margin ($ Mean)",
        "Runtime (ms)",
        "Waste Reduction %",
    ])

    for p in sim_res.policy_results:
        writer.writerow([
            p["policy_name"],
            p["waste_units_mean"],
            p["waste_units_min"],
            p["waste_units_max"],
            p["waste_cost_mean"],
            p["stockout_units_mean"],
            p["service_level_pct_mean"],
            p["net_margin_mean"],
            p["runtime_ms_mean"],
            p["waste_reduction_pct"],
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=zerowaste_evaluation_metrics.csv"},
    )
