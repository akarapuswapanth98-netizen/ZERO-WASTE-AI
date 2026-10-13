"""Coordinator Agent: Applies deterministic business rules, constraints, and tie-breaking logic."""
from typing import Any, Dict, List, Optional
from app.agents.base import BaseAgent
from app.models.schemas import ActionOptionScore, RecommendationProposal

TIE_BREAK_ORDER = [
    "no_action",
    "markdown_10",
    "markdown_20",
    "markdown_30",
    "markdown_50",
    "donate",
    "transfer",
    "replenish",
]


class CoordinatorAgent(BaseAgent):
    """Coordinator that validates outputs and selects exactly one proposal per (store, SKU)."""

    def __init__(self):
        super().__init__(name="CoordinatorAgent")

    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        store_id = int(inputs["store_id"])
        product_id = int(inputs["product_id"])
        on_hand_units = int(inputs["on_hand_units"])
        at_risk_units = int(inputs["at_risk_units"])
        risk_level = inputs["risk_level"]
        risk_ratio = float(inputs["risk_ratio"])
        forecast_demand = float(inputs.get("forecast_demand", 0.0))
        raw_options = inputs["options"]  # List of ActionOptionScore dicts
        product = inputs["product"]

        options = [ActionOptionScore(**opt) for opt in raw_options]

        # 1. Deterministic Constraint Filtering
        feasible_options: List[ActionOptionScore] = []
        for opt in options:
            if not opt.is_feasible:
                continue

            # Constraint: No replenishment into high spoilage position
            if opt.action == "replenish" and risk_level == "High":
                continue

            # Constraint: Transfer must have valid receiving store with need
            if opt.action == "transfer":
                rec_store = opt.details.get("receiving_store_id")
                if not rec_store or rec_store == store_id:
                    continue

            # Constraint: Donate must have units > 0
            if opt.action == "donate" and opt.details.get("eligible_units", 0) <= 0:
                continue

            # Quantities must be within 0..available_stock
            if opt.action.startswith("markdown"):
                cleared = opt.details.get("cleared_units", 0)
                if cleared < 0 or cleared > on_hand_units:
                    continue

            feasible_options.append(opt)

        if not feasible_options:
            # Fallback to no-action if all else fails
            no_act = next((opt for opt in options if opt.action == "no_action"), None)
            if not no_act:
                no_act = ActionOptionScore(
                    action="no_action",
                    is_feasible=True,
                    expected_loss=0.0,
                    waste_avoided_kg=0.0,
                    cost_impact=0.0,
                    details={"fallback": True},
                )
            feasible_options = [no_act]

        # 2. Select Minimum Expected Loss with Deterministic Tie-Breaking
        def tie_breaker_key(opt: ActionOptionScore) -> tuple:
            tie_rank = 99
            for idx, prefix in enumerate(TIE_BREAK_ORDER):
                if opt.action == prefix or opt.action.startswith(prefix):
                    tie_rank = idx
                    break
            return (round(opt.expected_loss, 2), tie_rank)

        feasible_options.sort(key=tie_breaker_key)
        winner = feasible_options[0]

        # 3. Determine integer proposed quantity
        if winner.action.startswith("markdown"):
            proposed_qty = int(winner.details.get("cleared_units", at_risk_units))
        elif winner.action == "donate":
            proposed_qty = int(winner.details.get("eligible_units", at_risk_units))
        elif winner.action == "transfer":
            proposed_qty = int(winner.details.get("transferred_units", at_risk_units))
        elif winner.action == "replenish":
            proposed_qty = int(winner.details.get("replenish_qty", 10))
        else:
            proposed_qty = 0

        # Enforce bounds: proposed_quantity in [0, on_hand_units] unless replenish
        if winner.action != "replenish":
            proposed_qty = max(0, min(proposed_qty, on_hand_units))

        # 4. Generate deterministic explanation
        p_name = product.get("name", f"SKU-{product_id}")
        if winner.action.startswith("markdown"):
            disc = int(winner.details.get("discount_pct", 0.20) * 100)
            explanation = (
                f"Apply {disc}% markdown to {proposed_qty} units of {p_name}. Under price elasticity E=1.5, "
                f"elevated demand clears near-expiry inventory, minimizing net expected loss to ${winner.expected_loss:.2f}."
            )
        elif winner.action == "donate":
            explanation = (
                f"Donate {proposed_qty} units of {p_name} to local food recovery partners. Avoids ${winner.cost_impact:.2f} "
                f"landfill waste and earns 20% salvage value while preserving food safety."
            )
        elif winner.action == "transfer":
            target_name = winner.details.get("receiving_store_name", "partner branch")
            explanation = (
                f"Transfer {proposed_qty} units of {p_name} to {target_name}. Quantified deficit at destination "
                f"absorbs stock at $0.50/unit freight, preserving retail margin."
            )
        elif winner.action == "replenish":
            explanation = (
                f"Order {proposed_qty} units of {p_name}. Stock is below safety reorder threshold with low spoilage risk "
                f"({round(risk_ratio * 100, 1)}%), preventing costly stockout."
            )
        else:
            explanation = (
                f"Maintain current position for {p_name}. Projected sell-through aligns with batch shelf-life; "
                f"expected loss is minimized without intervention."
            )

        proposal = RecommendationProposal(
            store_id=store_id,
            product_id=product_id,
            product_name=p_name,
            sku=product.get("sku"),
            category=product.get("category"),
            proposed_action=winner.action,
            proposed_quantity=proposed_qty,
            current_stock=on_hand_units,
            forecast_demand=forecast_demand,
            risk_level=risk_level,
            risk_ratio=risk_ratio,
            expected_loss=winner.expected_loss,
            waste_avoided_kg=winner.waste_avoided_kg,
            cost_impact=winner.cost_impact,
            alternatives=options,
            explanation=explanation,
            status="pending",
        )

        return proposal.model_dump(mode="json")
