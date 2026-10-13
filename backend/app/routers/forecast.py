"""Demand forecasting router."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import verify_api_key
from app.config import get_settings
from app.database import get_db_cursor
from app.ml.forecasting import run_forecasting_pipeline
from app.models.schemas import ForecastResult

router = APIRouter(prefix="/api/forecast", tags=["Forecasting"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=ForecastResult)
def get_demand_forecast(
    store_id: int = Query(default=1, description="Store ID"),
    product_id: int = Query(default=1, description="Product ID"),
    horizon_days: int = Query(default=7, ge=1, le=28, description="Forecast horizon in days"),
):
    """Retrieve candidate model comparison, winner model, point forecast, and residual intervals."""
    settings = get_settings()
    as_of = date.fromisoformat(settings.AS_OF_DATE)

    with get_db_cursor() as cur:
        # Fetch sales history up to as_of
        cur.execute(
            """
            SELECT sale_date, units_sold
            FROM sales_history
            WHERE store_id = %s AND product_id = %s AND sale_date <= %s
            ORDER BY sale_date ASC;
            """,
            (store_id, product_id, as_of),
        )
        sales_records = [(r[0], r[1]) for r in cur.fetchall()]

    if not sales_records:
        raise HTTPException(
            status_code=404,
            detail=f"No sales history found for store {store_id} and product {product_id}.",
        )

    res = run_forecasting_pipeline(
        sales_series=sales_records,
        horizon_days=horizon_days,
        store_id=store_id,
        product_id=product_id,
        as_of_date=as_of,
    )

    return res
