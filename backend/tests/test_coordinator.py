"""Tests for coordinator business rules, constraints, and deterministic decision logic."""
from app.agents.coordinator import CoordinatorAgent
from app.models.schemas import ActionOptionScore


def test_coordinator_forbids_replenishment_into_high_spoilage():
    """Rule: No replenishment into a high-spoilage position."""
    coord = CoordinatorAgent()

    # Replenish option with low expected loss, but risk is High
    options = [
        ActionOptionScore(
            action="replenish",
            is_feasible=True,
            expected_loss=5.0,
            waste_avoided_kg=0.0,
            cost_impact=20.0,
            details={"replenish_qty": 15},
        ).model_dump(),
        ActionOptionScore(
            action="no_action",
            is_feasible=True,
            expected_loss=30.0,
            waste_avoided_kg=0.0,
            cost_impact=0.0,
            details={},
        ).model_dump(),
    ]

    res = coord.run({
        "store_id": 1,
        "product_id": 1,
        "on_hand_units": 40,
        "at_risk_units": 20,
        "risk_level": "High",  # HIGH RISK!
        "risk_ratio": 0.50,
        "options": options,
        "product": {"sku": "DAI-001", "name": "Milk", "category": "dairy"},
    })

    # Replenish MUST be rejected due to High risk constraint; fallback to no_action
    assert res["proposed_action"] == "no_action"


def test_coordinator_quantity_bounds():
    """Rule: Proposed quantity must be integer and within [0, on_hand_units] for markdown/donate/transfer."""
    coord = CoordinatorAgent()
    options = [
        ActionOptionScore(
            action="markdown_20",
            is_feasible=True,
            expected_loss=10.0,
            waste_avoided_kg=5.0,
            cost_impact=4.0,
            details={"discount_pct": 0.20, "cleared_units": 25},
        ).model_dump(),
    ]

    res = coord.run({
        "store_id": 1,
        "product_id": 1,
        "on_hand_units": 20,  # Only 20 units on hand!
        "at_risk_units": 20,
        "risk_level": "Medium",
        "risk_ratio": 0.25,
        "options": options,
        "product": {"sku": "DAI-001", "name": "Milk", "category": "dairy"},
    })

    # Proposed qty cannot exceed on-hand
    assert res["proposed_quantity"] <= 20
    assert isinstance(res["proposed_quantity"], int)


def test_coordinator_tie_breaking_order():
    """Rule: Deterministic tie-break order no-action, markdown, donate, transfer, replenish."""
    coord = CoordinatorAgent()

    # Both markdown and donate have identical expected loss
    options = [
        ActionOptionScore(
            action="donate",
            is_feasible=True,
            expected_loss=15.00,
            waste_avoided_kg=5.0,
            cost_impact=10.0,
            details={"eligible_units": 10},
        ).model_dump(),
        ActionOptionScore(
            action="markdown_20",
            is_feasible=True,
            expected_loss=15.00,
            waste_avoided_kg=5.0,
            cost_impact=6.0,
            details={"discount_pct": 0.20, "cleared_units": 10},
        ).model_dump(),
    ]

    res = coord.run({
        "store_id": 1,
        "product_id": 1,
        "on_hand_units": 30,
        "at_risk_units": 10,
        "risk_level": "Medium",
        "risk_ratio": 0.20,
        "options": options,
        "product": {"sku": "DAI-001", "name": "Milk", "category": "dairy"},
    })

    # markdown has priority over donate
    assert res["proposed_action"] == "markdown_20"


def test_coordinator_exactly_one_proposal_with_alternatives():
    """Rule: Exactly ONE primary proposed action with ranked alternatives."""
    coord = CoordinatorAgent()
    options = [
        ActionOptionScore(action="no_action", is_feasible=True, expected_loss=25.0, waste_avoided_kg=0.0, cost_impact=0.0, details={}).model_dump(),
        ActionOptionScore(action="markdown_20", is_feasible=True, expected_loss=12.0, waste_avoided_kg=8.0, cost_impact=4.0, details={"cleared_units": 8}).model_dump(),
        ActionOptionScore(action="donate", is_feasible=True, expected_loss=18.0, waste_avoided_kg=8.0, cost_impact=8.0, details={"eligible_units": 8}).model_dump(),
    ]

    res = coord.run({
        "store_id": 1,
        "product_id": 1,
        "on_hand_units": 30,
        "at_risk_units": 8,
        "risk_level": "Medium",
        "risk_ratio": 0.25,
        "options": options,
        "product": {"sku": "DAI-001", "name": "Milk", "category": "dairy"},
    })

    assert res["proposed_action"] == "markdown_20"
    assert len(res["alternatives"]) == 3
    assert len(res["explanation"]) > 20
