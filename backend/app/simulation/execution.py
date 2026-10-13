"""Simulated inventory execution with safety re-verification, stock auditing, and failure handling."""
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from app.database import get_db_cursor
from app.models.schemas import ApproveProposalRequest, BulkApproveRequest, ExecutionResult, RejectProposalRequest
from app.simulation.adapters import SimulatedERPAdapter, SimulatedPOSAdapter, SimulatedWMSAdapter


def record_audit_log(
    action_type: str,
    entity_type: str,
    entity_id: Optional[int],
    actor: str,
    details: Dict[str, Any],
    database_url: Optional[str] = None,
) -> None:
    """Record an audit trail event in audit_logs."""
    now = datetime.now(timezone.utc)
    try:
        with get_db_cursor(database_url) as cur:
            cur.execute(
                """
                INSERT INTO audit_logs (action_type, entity_type, entity_id, actor, details_json, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (action_type, entity_type, entity_id, actor, json.dumps(details, default=str), now),
            )
    except Exception:
        pass


def execute_approved_recommendation(
    req: ApproveProposalRequest,
    database_url: Optional[str] = None,
) -> ExecutionResult:
    """Safely execute an approved recommendation after stock re-verification."""
    with get_db_cursor(database_url) as cur:
        # 1. Fetch recommendation details
        cur.execute(
            """
            SELECT id, store_id, product_id, proposed_action, proposed_quantity, current_stock, status, alternatives_json
            FROM recommendations
            WHERE id = %s
            FOR UPDATE;
            """,
            (req.recommendation_id,),
        )
        rec_row = cur.fetchone()
        if not rec_row:
            raise ValueError(f"Recommendation ID {req.recommendation_id} not found.")

        rec_id, store_id, product_id, proposed_action, orig_proposed_qty, rec_stock_snapshot, status, alternatives_raw = rec_row

        if status in ("executed", "rejected"):
            raise ValueError(f"Recommendation {rec_id} cannot be executed: current status is already '{status}'.")

        # 2. Determine execution quantity with safe bound validation
        exec_qty = req.approved_quantity if req.approved_quantity is not None else orig_proposed_qty
        if proposed_action != "no_action" and proposed_action != "replenish":
            if exec_qty < 1 or exec_qty > orig_proposed_qty:
                raise ValueError(
                    f"Approved quantity {exec_qty} is outside safe bounds [1, {orig_proposed_qty}]."
                )

        # 3. RE-VERIFY CURRENT STOCK AT EXECUTION TIME
        cur.execute(
            """
            SELECT COALESCE(SUM(current_quantity), 0)
            FROM inventory_batches
            WHERE store_id = %s AND product_id = %s AND current_quantity > 0;
            """,
            (store_id, product_id),
        )
        actual_current_stock = int(cur.fetchone()[0])

        # IF STOCK CHANGED SINCE GENERATION -> MARK EXECUTION FAILED!
        if actual_current_stock != rec_stock_snapshot and proposed_action != "replenish":
            failure_reason = (
                f"Execution failed: On-hand stock changed from {rec_stock_snapshot} to {actual_current_stock} "
                "since recommendation generation."
            )
            # Update recommendation status to failed
            cur.execute("UPDATE recommendations SET status = 'failed' WHERE id = %s;", (rec_id,))

            # Record planner decision with failed execution status
            cur.execute(
                """
                INSERT INTO planner_decisions (
                    recommendation_id, decision, approved_quantity, reason,
                    decided_by, execution_status, execution_result_json
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    rec_id,
                    "approved",
                    exec_qty,
                    req.reason or "Stock mismatch on execution",
                    req.decided_by,
                    "failed",
                    json.dumps({"error": failure_reason, "stock_before": actual_current_stock}),
                ),
            )

            record_audit_log(
                action_type="EXECUTION_FAILED",
                entity_type="recommendation",
                entity_id=rec_id,
                actor=req.decided_by,
                details={"reason": failure_reason, "expected_stock": rec_stock_snapshot, "actual_stock": actual_current_stock},
                database_url=database_url,
            )

            return ExecutionResult(
                success=False,
                status="failed",
                recommendation_id=rec_id,
                action=proposed_action,
                quantity=exec_qty,
                message=failure_reason,
                stock_before=actual_current_stock,
                stock_after=actual_current_stock,
                events_logged=[],
            )

        # 4. Stock verified! Proceed with simulated execution
        stock_before = actual_current_stock
        stock_after = actual_current_stock
        events: List[Dict[str, Any]] = []

        if proposed_action.startswith("markdown"):
            # Markdown: Updates price in POS, does not instantly reduce stock
            disc_pct = 0.20
            if "_" in proposed_action:
                try:
                    disc_pct = float(proposed_action.split("_")[1]) / 100.0
                except Exception:
                    disc_pct = 0.20
            cur.execute("SELECT price FROM products WHERE id = %s;", (product_id,))
            orig_p = float(cur.fetchone()[0])
            md_p = round(orig_p * (1.0 - disc_pct), 2)
            SimulatedPOSAdapter.update_shelf_price_markdown(store_id, product_id, orig_p, md_p, database_url)
            events.append({"system": "POS", "event": "SHELF_LABEL_MARKDOWN", "discount": disc_pct, "markdown_price": md_p})

        elif proposed_action == "donate":
            # Donate: Removes units from nearest-expiry batches, notifies WMS
            units_to_remove = exec_qty
            cur.execute(
                """
                SELECT id, batch_code, current_quantity
                FROM inventory_batches
                WHERE store_id = %s AND product_id = %s AND current_quantity > 0
                ORDER BY expiry_date ASC
                FOR UPDATE;
                """,
                (store_id, product_id),
            )
            for b_id, b_code, b_qty in cur.fetchall():
                if units_to_remove <= 0:
                    break
                take = min(b_qty, units_to_remove)
                cur.execute(
                    "UPDATE inventory_batches SET current_quantity = current_quantity - %s WHERE id = %s;",
                    (take, b_id),
                )
                SimulatedWMSAdapter.issue_pick_order_for_donation(store_id, product_id, b_code, take, database_url)
                units_to_remove -= take
                events.append({"system": "WMS", "event": "DONATION_PICK_ORDER", "batch_code": b_code, "quantity": take})
            stock_after = max(0, stock_before - exec_qty)

        elif proposed_action == "transfer":
            # Transfer: Removes units from source, records WMS manifest
            units_to_remove = exec_qty
            cur.execute(
                """
                SELECT id, current_quantity
                FROM inventory_batches
                WHERE store_id = %s AND product_id = %s AND current_quantity > 0
                ORDER BY expiry_date ASC
                FOR UPDATE;
                """,
                (store_id, product_id),
            )
            for b_id, b_qty in cur.fetchall():
                if units_to_remove <= 0:
                    break
                take = min(b_qty, units_to_remove)
                cur.execute(
                    "UPDATE inventory_batches SET current_quantity = current_quantity - %s WHERE id = %s;",
                    (take, b_id),
                )
                units_to_remove -= take
            # Receiving store from alternatives
            rec_store_id = 2 if store_id != 2 else 1
            SimulatedWMSAdapter.initiate_inter_store_transfer(store_id, rec_store_id, product_id, exec_qty, database_url)
            events.append({"system": "WMS", "event": "INTER_STORE_TRANSFER", "to_store_id": rec_store_id, "quantity": exec_qty})
            stock_after = max(0, stock_before - exec_qty)

        elif proposed_action == "replenish":
            # Replenish: Submits PO to ERP
            cur.execute("SELECT unit_cost FROM products WHERE id = %s;", (product_id,))
            u_cost = float(cur.fetchone()[0])
            SimulatedERPAdapter.submit_replenishment_purchase_order(store_id, product_id, exec_qty, u_cost, database_url)
            events.append({"system": "ERP", "event": "PURCHASE_ORDER_SUBMITTED", "quantity": exec_qty, "unit_cost": u_cost})

        # Update recommendation status to executed
        cur.execute("UPDATE recommendations SET status = 'executed' WHERE id = %s;", (rec_id,))

        # Record planner decision
        exec_payload = {
            "success": True,
            "stock_before": stock_before,
            "stock_after": stock_after,
            "events": events,
        }
        cur.execute(
            """
            INSERT INTO planner_decisions (
                recommendation_id, decision, approved_quantity, reason,
                decided_by, execution_status, execution_result_json
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (
                rec_id,
                "approved",
                exec_qty,
                req.reason or "Approved by inventory planner",
                req.decided_by,
                "executed",
                json.dumps(exec_payload),
            ),
        )

        record_audit_log(
            action_type="EXECUTION_COMPLETED",
            entity_type="recommendation",
            entity_id=rec_id,
            actor=req.decided_by,
            details=exec_payload,
            database_url=database_url,
        )

        return ExecutionResult(
            success=True,
            status="executed",
            recommendation_id=rec_id,
            action=proposed_action,
            quantity=exec_qty,
            message="Recommendation executed successfully in simulated environment.",
            stock_before=stock_before,
            stock_after=stock_after,
            events_logged=events,
        )


def reject_recommendation(
    req: RejectProposalRequest,
    database_url: Optional[str] = None,
) -> ExecutionResult:
    """Reject proposal: Strictly executes NOTHING, updates status, and logs audit."""
    with get_db_cursor(database_url) as cur:
        cur.execute(
            "SELECT id, store_id, product_id, proposed_action, current_stock, status FROM recommendations WHERE id = %s FOR UPDATE;",
            (req.recommendation_id,),
        )
        row = cur.fetchone()
        if not row:
            raise ValueError(f"Recommendation ID {req.recommendation_id} not found.")

        rec_id, store_id, product_id, proposed_action, current_stock, status = row
        if status in ("executed", "rejected"):
            raise ValueError(f"Recommendation {rec_id} is already '{status}'.")

        # Update status to rejected
        cur.execute("UPDATE recommendations SET status = 'rejected' WHERE id = %s;", (rec_id,))

        # Record decision: NO ACTIONS EXECUTED
        cur.execute(
            """
            INSERT INTO planner_decisions (
                recommendation_id, decision, approved_quantity, reason,
                decided_by, execution_status, execution_result_json
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (
                rec_id,
                "rejected",
                0,
                req.reason,
                req.decided_by,
                "rejected_no_action",
                json.dumps({"executed": False, "reason": req.reason}),
            ),
        )

        record_audit_log(
            action_type="RECOMMENDATION_REJECTED",
            entity_type="recommendation",
            entity_id=rec_id,
            actor=req.decided_by,
            details={"action": proposed_action, "reason": req.reason},
            database_url=database_url,
        )

        return ExecutionResult(
            success=True,
            status="rejected_no_action",
            recommendation_id=rec_id,
            action=proposed_action,
            quantity=0,
            message="Recommendation rejected. No changes executed to inventory or pricing.",
            stock_before=current_stock,
            stock_after=current_stock,
            events_logged=[],
        )


def bulk_approve_low_risk(
    req: BulkApproveRequest,
    database_url: Optional[str] = None,
) -> List[ExecutionResult]:
    """Bulk approve proposals strictly restricted to Low-risk items."""
    results: List[ExecutionResult] = []
    with get_db_cursor(database_url) as cur:
        for rec_id in req.recommendation_ids:
            cur.execute("SELECT risk_level FROM recommendations WHERE id = %s;", (rec_id,))
            row = cur.fetchone()
            if not row:
                continue
            if row[0] != "Low":
                # Reject bulk approval for Medium or High risk
                raise ValueError(
                    f"Recommendation {rec_id} has '{row[0]}' risk. "
                    "Bulk approval is permitted ONLY for Low-risk proposals."
                )

    for rec_id in req.recommendation_ids:
        single_req = ApproveProposalRequest(
            recommendation_id=rec_id,
            decided_by=req.decided_by,
            reason=req.reason or "Bulk approval (Low-risk)",
        )
        res = execute_approved_recommendation(single_req, database_url)
        results.append(res)

    return results
