"""Tests for approval, rejection safety, stock verification, and failure handling."""
import json
import pytest
from app.database import get_db_cursor
from app.models.schemas import ApproveProposalRequest, BulkApproveRequest, RejectProposalRequest
from app.simulation.execution import bulk_approve_low_risk, execute_approved_recommendation, reject_recommendation
from tests.conftest import TEST_DB_URL


def create_test_recommendation(
    action: str = "donate",
    qty: int = 10,
    risk_level: str = "Medium",
    initial_stock: int = 30,
) -> int:
    """Helper to insert a pending recommendation for testing."""
    with get_db_cursor(TEST_DB_URL) as cur:
        cur.execute("SELECT id FROM stores LIMIT 1;")
        s_row = cur.fetchone()
        if not s_row:
            from app.seed import seed_database
            seed_database(database_url=TEST_DB_URL, force_reset=True)
            cur.execute("SELECT id FROM stores LIMIT 1;")
            s_row = cur.fetchone()
        store_id = s_row[0]

        cur.execute("SELECT id FROM products LIMIT 1;")
        product_id = cur.fetchone()[0]

        # Align batch stock to initial_stock
        cur.execute(
            """
            UPDATE inventory_batches
            SET current_quantity = %s
            WHERE id = (
                SELECT id FROM inventory_batches
                WHERE store_id = %s AND product_id = %s
                LIMIT 1
            );
            """,
            (initial_stock, store_id, product_id),
        )
        cur.execute(
            """
            SELECT COALESCE(SUM(current_quantity), 0)
            FROM inventory_batches
            WHERE store_id = %s AND product_id = %s;
            """,
            (store_id, product_id),
        )
        total_stock = int(cur.fetchone()[0])

        cur.execute(
            """
            INSERT INTO recommendations (
                store_id, product_id, proposed_action, proposed_quantity,
                current_stock, forecast_demand, risk_level, risk_ratio,
                expected_loss, waste_avoided_kg, cost_impact, alternatives_json,
                explanation, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                store_id,
                product_id,
                action,
                qty,
                total_stock,
                15.0,
                risk_level,
                0.25,
                12.50,
                5.0,
                10.0,
                json.dumps([]),
                "Test proposal explanation",
                "pending",
            ),
        )
        return cur.fetchone()[0]


def test_rejected_proposal_executes_strictly_nothing():
    """Rule: Rejected proposals never execute."""
    rec_id = create_test_recommendation(action="donate", qty=10)

    # Record initial stock
    with get_db_cursor(TEST_DB_URL) as cur:
        cur.execute("SELECT store_id, product_id, current_stock FROM recommendations WHERE id = %s;", (rec_id,))
        store_id, product_id, stock_before = cur.fetchone()

    # Reject
    req = RejectProposalRequest(recommendation_id=rec_id, reason="Planner decided not to proceed")
    result = reject_recommendation(req, database_url=TEST_DB_URL)

    assert result.success is True
    assert result.status == "rejected_no_action"
    assert result.quantity == 0

    # Stock must be completely unchanged
    with get_db_cursor(TEST_DB_URL) as cur:
        cur.execute("SELECT status FROM recommendations WHERE id = %s;", (rec_id,))
        assert cur.fetchone()[0] == "rejected"

        cur.execute(
            "SELECT execution_status FROM planner_decisions WHERE recommendation_id = %s;",
            (rec_id,),
        )
        assert cur.fetchone()[0] == "rejected_no_action"

        cur.execute(
            "SELECT COALESCE(SUM(current_quantity), 0) FROM inventory_batches WHERE store_id = %s AND product_id = %s;",
            (store_id, product_id),
        )
        stock_after = cur.fetchone()[0]
        assert stock_after == stock_before


def test_failed_execution_when_stock_changed_since_generation():
    """Rule: Re-check stock at execution and mark failed if it changed."""
    rec_id = create_test_recommendation(action="donate", qty=10)

    # Artificially alter stock behind the scenes (e.g. sales happened)
    with get_db_cursor(TEST_DB_URL) as cur:
        cur.execute("SELECT store_id, product_id FROM recommendations WHERE id = %s;", (rec_id,))
        store_id, product_id = cur.fetchone()
        cur.execute(
            """
            UPDATE inventory_batches
            SET current_quantity = current_quantity - 5
            WHERE id = (
                SELECT id FROM inventory_batches
                WHERE store_id = %s AND product_id = %s AND current_quantity > 5
                LIMIT 1
            );
            """,
            (store_id, product_id),
        )

    # Now attempt to approve and execute
    req = ApproveProposalRequest(recommendation_id=rec_id, reason="Approving recommendation")
    result = execute_approved_recommendation(req, database_url=TEST_DB_URL)

    # MUST FAIL!
    assert result.success is False
    assert result.status == "failed"
    assert "On-hand stock changed" in result.message

    # Verify recommendation status is failed in DB
    with get_db_cursor(TEST_DB_URL) as cur:
        cur.execute("SELECT status FROM recommendations WHERE id = %s;", (rec_id,))
        assert cur.fetchone()[0] == "failed"

        cur.execute(
            "SELECT execution_status FROM planner_decisions WHERE recommendation_id = %s;",
            (rec_id,),
        )
        assert cur.fetchone()[0] == "failed"


def test_successful_approval_and_execution_updates_stock():
    """Verify approval with matching stock executes, updates stock, and records adapter events."""
    rec_id = create_test_recommendation(action="donate", qty=5)

    with get_db_cursor(TEST_DB_URL) as cur:
        cur.execute("SELECT store_id, product_id FROM recommendations WHERE id = %s;", (rec_id,))
        store_id, product_id = cur.fetchone()
        cur.execute(
            "SELECT COALESCE(SUM(current_quantity), 0) FROM inventory_batches WHERE store_id = %s AND product_id = %s;",
            (store_id, product_id),
        )
        stock_before = int(cur.fetchone()[0])
        # Ensure recommendation stock matches current stock
        cur.execute("UPDATE recommendations SET current_stock = %s WHERE id = %s;", (stock_before, rec_id))

    req = ApproveProposalRequest(recommendation_id=rec_id, approved_quantity=5, reason="Approved by tester")
    result = execute_approved_recommendation(req, database_url=TEST_DB_URL)

    assert result.success is True
    assert result.status == "executed"
    assert result.stock_after == stock_before - 5
    assert len(result.events_logged) > 0


def test_bulk_approve_only_allows_low_risk():
    """Rule: Bulk-approve for low-risk only. Medium or High risk must be rejected."""
    low_id = create_test_recommendation(action="markdown_20", qty=5, risk_level="Low")
    high_id = create_test_recommendation(action="donate", qty=10, risk_level="High")

    # Attempting to bulk approve with a high-risk item must fail
    with pytest.raises(ValueError) as exc:
        bulk_approve_low_risk(
            BulkApproveRequest(recommendation_ids=[low_id, high_id]),
            database_url=TEST_DB_URL,
        )
    assert "Bulk approval is permitted ONLY for Low-risk proposals" in str(exc.value)

    # Bulk approve strictly low-risk item succeeds
    results = bulk_approve_low_risk(
        BulkApproveRequest(recommendation_ids=[low_id]),
        database_url=TEST_DB_URL,
    )
    assert len(results) == 1
    assert results[0].status == "executed"
