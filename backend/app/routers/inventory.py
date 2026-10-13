"""Inventory management endpoints."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from app.auth import verify_api_key
from app.database import get_db_cursor

router = APIRouter(prefix="/api/inventory", tags=["Inventory"], dependencies=[Depends(verify_api_key)])


@router.get("")
def get_inventory_overview():
    """Retrieve full inventory summary, stores, and products with on-hand counts."""
    with get_db_cursor() as cur:
        # Stores
        cur.execute("SELECT id, code, name, location, square_meters FROM stores ORDER BY id;")
        stores = [
            {"id": r[0], "code": r[1], "name": r[2], "location": r[3], "square_meters": r[4]}
            for r in cur.fetchall()
        ]

        # Products with current total inventory
        cur.execute(
            """
            SELECT p.id, p.sku, p.name, p.category, p.unit_cost, p.price,
                   p.shelf_life_days, p.unit_weight_kg, p.supplier_lead_time_days, p.min_order_qty,
                   COALESCE(SUM(b.current_quantity), 0) AS total_on_hand
            FROM products p
            LEFT JOIN inventory_batches b ON p.id = b.product_id AND b.current_quantity > 0
            GROUP BY p.id
            ORDER BY p.id;
            """
        )
        products = [
            {
                "id": r[0],
                "sku": r[1],
                "name": r[2],
                "category": r[3],
                "unit_cost": float(r[4]),
                "price": float(r[5]),
                "shelf_life_days": r[6],
                "unit_weight_kg": float(r[7]),
                "supplier_lead_time_days": r[8],
                "min_order_qty": r[9],
                "total_on_hand": int(r[10]),
            }
            for r in cur.fetchall()
        ]

        # Aggregate metrics
        cur.execute(
            """
            SELECT 
                COUNT(*) AS total_batches,
                COALESCE(SUM(current_quantity), 0) AS total_units,
                COALESCE(SUM(current_quantity * unit_cost), 0) AS total_inventory_value
            FROM inventory_batches
            WHERE current_quantity > 0;
            """
        )
        agg_row = cur.fetchone()

        return {
            "stores": stores,
            "products": products,
            "summary": {
                "active_batches_count": int(agg_row[0]),
                "total_units_on_hand": int(agg_row[1]),
                "total_inventory_value": round(float(agg_row[2]), 2),
            },
        }


@router.get("/batches")
def get_inventory_batches(
    store_id: Optional[int] = Query(default=None),
    product_id: Optional[int] = Query(default=None),
    category: Optional[str] = Query(default=None),
):
    """Retrieve filtered active inventory batches."""
    query = """
        SELECT b.id, b.store_id, s.name AS store_name, b.product_id, p.name AS product_name,
               p.sku, p.category, b.batch_code, b.received_date, b.expiry_date,
               b.initial_quantity, b.current_quantity, b.unit_cost
        FROM inventory_batches b
        JOIN stores s ON b.store_id = s.id
        JOIN products p ON b.product_id = p.id
        WHERE b.current_quantity > 0
    """
    params = []
    if store_id:
        query += " AND b.store_id = %s"
        params.append(store_id)
    if product_id:
        query += " AND b.product_id = %s"
        params.append(product_id)
    if category:
        query += " AND p.category = %s"
        params.append(category)

    query += " ORDER BY b.expiry_date ASC, b.id ASC;"

    with get_db_cursor() as cur:
        cur.execute(query, tuple(params))
        batches = [
            {
                "id": r[0],
                "store_id": r[1],
                "store_name": r[2],
                "product_id": r[3],
                "product_name": r[4],
                "sku": r[5],
                "category": r[6],
                "batch_code": r[7],
                "received_date": r[8].isoformat(),
                "expiry_date": r[9].isoformat(),
                "initial_quantity": r[10],
                "current_quantity": r[11],
                "unit_cost": float(r[12]),
            }
            for r in cur.fetchall()
        ]

    return {"count": len(batches), "batches": batches}
