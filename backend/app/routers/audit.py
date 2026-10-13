"""Audit log and simulated system integration events router."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from app.auth import verify_api_key
from app.database import get_db_cursor

router = APIRouter(prefix="/api/audit", tags=["Audit"], dependencies=[Depends(verify_api_key)])


@router.get("/logs")
def get_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    action_type: Optional[str] = Query(default=None),
):
    """Retrieve human-readable planner audit logs and decision trails."""
    query = "SELECT id, action_type, entity_type, entity_id, actor, details_json, timestamp FROM audit_logs"
    params = []
    if action_type:
        query += " WHERE action_type = %s"
        params.append(action_type)
    query += " ORDER BY timestamp DESC LIMIT %s;"
    params.append(limit)

    with get_db_cursor() as cur:
        cur.execute(query, tuple(params))
        logs = [
            {
                "id": r[0],
                "action_type": r[1],
                "entity_type": r[2],
                "entity_id": r[3],
                "actor": r[4],
                "details": r[5],
                "timestamp": r[6].isoformat(),
            }
            for r in cur.fetchall()
        ]

    return {"count": len(logs), "logs": logs}


@router.get("/events")
def get_simulated_system_events(
    limit: int = Query(default=50, ge=1, le=200),
    system_name: Optional[str] = Query(default=None),
):
    """Retrieve simulated POS, WMS, and ERP adapter events."""
    query = "SELECT id, system_name, event_type, payload_json, timestamp FROM sim_system_events"
    params = []
    if system_name:
        query += " WHERE system_name = %s"
        params.append(system_name)
    query += " ORDER BY timestamp DESC LIMIT %s;"
    params.append(limit)

    with get_db_cursor() as cur:
        cur.execute(query, tuple(params))
        events = [
            {
                "id": r[0],
                "system_name": r[1],
                "event_type": r[2],
                "payload": r[3],
                "timestamp": r[4].isoformat(),
            }
            for r in cur.fetchall()
        ]

    return {"count": len(events), "events": events}
