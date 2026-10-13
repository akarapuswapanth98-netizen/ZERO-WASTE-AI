import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import verify_api_key
from app.database import get_db_cursor
from app.models.schemas import ApproveProposalRequest, BulkApproveRequest, ExecutionResult, RejectProposalRequest
from app.simulation.execution import bulk_approve_low_risk, execute_approved_recommendation, reject_recommendation

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"], dependencies=[Depends(verify_api_key)])


@router.get("")
def list_recommendations(
    store_id: Optional[int] = Query(default=None),
    product_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    risk_level: Optional[str] = Query(default=None),
):
    """Retrieve list of generated inventory recommendations with detailed financial impact and alternatives."""
    query = """
        SELECT r.id, r.store_id, s.name AS store_name, r.product_id, p.name AS product_name,
               p.sku, p.category, r.proposed_action, r.proposed_quantity, r.current_stock,
               r.expiry_date, r.forecast_demand, r.risk_level, r.risk_ratio, r.expected_loss,
               r.waste_avoided_kg, r.cost_impact, r.alternatives_json, r.explanation, r.status,
               r.created_at
        FROM recommendations r
        JOIN stores s ON r.store_id = s.id
        JOIN products p ON r.product_id = p.id
        WHERE 1=1
    """
    params = []
    if store_id:
        query += " AND r.store_id = %s"
        params.append(store_id)
    if product_id:
        query += " AND r.product_id = %s"
        params.append(product_id)
    if status:
        query += " AND r.status = %s"
        params.append(status)
    if risk_level:
        query += " AND r.risk_level = %s"
        params.append(risk_level)

    query += " ORDER BY r.created_at DESC, r.id DESC;"

    with get_db_cursor() as cur:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()

    def _parse_alt(val):
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return val
        return val

    items = [
        {
            "id": r[0],
            "store_id": r[1],
            "store_name": r[2],
            "product_id": r[3],
            "product_name": r[4],
            "sku": r[5],
            "category": r[6],
            "proposed_action": r[7],
            "proposed_quantity": r[8],
            "current_stock": r[9],
            "expiry_date": r[10].isoformat() if hasattr(r[10], "isoformat") else (str(r[10]) if r[10] else None),
            "forecast_demand": float(r[11]),
            "risk_level": r[12],
            "risk_ratio": float(r[13]),
            "expected_loss": float(r[14]),
            "waste_avoided_kg": float(r[15]),
            "cost_impact": float(r[16]),
            "alternatives": _parse_alt(r[17]),
            "explanation": r[18],
            "status": r[19],
            "created_at": r[20].isoformat() if hasattr(r[20], "isoformat") else (str(r[20]) if r[20] else None),
        }
        for r in rows
    ]

    return {"count": len(items), "recommendations": items}


@router.post("/approve", response_model=ExecutionResult)
def approve_proposal(req: ApproveProposalRequest):
    """Approve a recommendation proposal with optional quantity reduction and execution re-verification."""
    try:
        return execute_approved_recommendation(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/reject", response_model=ExecutionResult)
def reject_proposal(req: RejectProposalRequest):
    """Reject a recommendation proposal. Crucial safety rule: executes strictly nothing."""
    try:
        return reject_recommendation(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/bulk-approve", response_model=List[ExecutionResult])
def bulk_approve_proposals(req: BulkApproveRequest):
    """Bulk-approve proposals. Permitted strictly for Low-risk proposals only."""
    try:
        return bulk_approve_low_risk(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
