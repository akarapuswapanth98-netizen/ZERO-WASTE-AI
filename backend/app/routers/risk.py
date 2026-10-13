"""Spoilage risk assessment router with time-travel day offset support."""
from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import verify_api_key
from app.config import get_settings
from app.database import get_db_cursor
from app.ml.forecasting import run_forecasting_pipeline
from app.ml.risk import evaluate_spoilage_risk
from app.models.schemas import SpoilageRiskResult

router = APIRouter(prefix="/api/risk", tags=["Spoilage Risk"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=SpoilageRiskResult)
def get_spoilage_risk(
    store_id: int = Query(default=1),
    product_id: int = Query(default=1),
    day_offset: int = Query(default=0, ge=0, le=7, description="Time travel offset in days (0-7)"),
    low_threshold: float = Query(default=0.10, ge=0.01, le=0.50),
    med_threshold: float = Query(default=0.30, ge=0.05, le=0.90),
):
    """Assess batch spoilage risk with FIFO consumption and backend time-travel simulation."""
    settings = get_settings()
    as_of = date.fromisoformat(settings.AS_OF_DATE)

    with get_db_cursor() as cur:
        # Fetch batches
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

        # Fetch sales history for forecast
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

    forecast = run_forecasting_pipeline(
        sales_series=sales,
        horizon_days=14,
        store_id=store_id,
        product_id=product_id,
        as_of_date=as_of,
    )

    risk_res = evaluate_spoilage_risk(
        batches=batches,
        forecast=forecast,
        as_of_date=as_of,
        day_offset=day_offset,
        low_thresh=low_threshold,
        med_thresh=med_threshold,
    )

    return risk_res


@router.get("/all")
def get_all_spoilage_risks(
    store_id: Optional[int] = Query(default=None),
    day_offset: int = Query(default=0, ge=0, le=7),
    low_threshold: float = Query(default=0.10),
    med_threshold: float = Query(default=0.30),
):
    """Evaluate spoilage risks across all store-product combinations."""
    settings = get_settings()
    as_of = date.fromisoformat(settings.AS_OF_DATE)

    with get_db_cursor() as cur:
        # Get distinct store-product pairs
        q = "SELECT DISTINCT store_id, product_id FROM inventory_batches WHERE current_quantity > 0"
        params = []
        if store_id:
            q += " AND store_id = %s"
            params.append(store_id)
        cur.execute(q, tuple(params))
        pairs = cur.fetchall()

    results = []
    for s_id, p_id in pairs:
        try:
            res = get_spoilage_risk(
                store_id=s_id,
                product_id=p_id,
                day_offset=day_offset,
                low_threshold=low_threshold,
                med_threshold=med_threshold,
            )
            results.append(res.model_dump())
        except Exception:
            pass

    return {
        "as_of_date": as_of.isoformat(),
        "day_offset": day_offset,
        "count": len(results),
        "risks": results,
    }
