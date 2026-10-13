"""Action Recommendation Agent: Computes expected loss and scores all inventory intervention options."""
from datetime import date
from typing import Any, Dict, List, Optional
from app.agents.base import BaseAgent
from app.models.schemas import ActionOptionScore

ELASTICITY_ASSUMPTION = 1.5  # Labelled price elasticity assumption: E = 1.5
DONATION_RECOVERY_RATE = 0.20  # Tax salvage / CSR salvage recovery: 20% of unit cost
TRANSFER_COST_PER_UNIT = 0.50  # Fixed transport & handling cost per unit


class RecommendationAgent(BaseAgent):
    """Agent that scores and ranks all five intervention options using decision theory."""

    def __init__(self):
        super().__init__(name="ActionRecommendationAgent")

    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        product = inputs["product"]
        on_hand_units = int(inputs["on_hand_units"])
        at_risk_units = int(inputs["at_risk_units"])
        risk_level = inputs["risk_level"]
        forecast_daily_avg = float(inputs.get("forecast_daily_avg", 1.0))
        inventory_analysis = inputs["inventory_analysis"]
        transfer_targets = inputs.get("transfer_targets", [])
        active_batches = inputs.get("active_batches", [])
        as_of = date.fromisoformat(inputs["as_of_date"]) if isinstance(inputs["as_of_date"], str) else inputs["as_of_date"]

        unit_cost = float(product["unit_cost"])
        unit_price = float(product["price"])
        unit_weight_kg = float(product["unit_weight_kg"])
        unit_margin = max(0.0, unit_price - unit_cost)

        options: List[ActionOptionScore] = []

        # ----------------------------------------------------
        # 1. Option: no_action
        # ----------------------------------------------------
        # Waste cost for at-risk units plus stockout penalty if understocked
        waste_cost_no_action = at_risk_units * unit_cost
        stockout_penalty = (
            inventory_analysis["suggested_replenish_qty"] * unit_margin
            if inventory_analysis.get("is_understock")
            else 0.0
        )
        loss_no_action = waste_cost_no_action + stockout_penalty

        options.append(
            ActionOptionScore(
                action="no_action",
                is_feasible=True,
                expected_loss=round(loss_no_action, 2),
                waste_avoided_kg=0.0,
                cost_impact=0.0,
                details={
                    "at_risk_units": at_risk_units,
                    "waste_cost": round(waste_cost_no_action, 2),
                    "stockout_penalty": round(stockout_penalty, 2),
                },
            )
        )

        # ----------------------------------------------------
        # 2. Option: markdown (evaluate 10%, 20%, 30%, 50%)
        # ----------------------------------------------------
        markdown_feasible = at_risk_units > 0 and on_hand_units > 0
        best_md_loss = float("inf")
        best_md_tier = 0.20
        best_md_avoided_units = 0
        best_md_giveaway = 0.0

        if markdown_feasible:
            for discount_pct in [0.10, 0.20, 0.30, 0.50]:
                # Elevated demand under labelled elasticity E = 1.5
                demand_lift = 1.0 + (ELASTICITY_ASSUMPTION * discount_pct)
                additional_sales = int(round(forecast_daily_avg * 3.0 * (demand_lift - 1.0)))
                cleared_units = min(at_risk_units, additional_sales)
                giveaway = cleared_units * (unit_price * discount_pct)
                residual_waste_units = max(0, at_risk_units - cleared_units)
                residual_waste_cost = residual_waste_units * unit_cost
                total_loss = giveaway + residual_waste_cost

                if total_loss < best_md_loss:
                    best_md_loss = total_loss
                    best_md_tier = discount_pct
                    best_md_avoided_units = cleared_units
                    best_md_giveaway = giveaway

            options.append(
                ActionOptionScore(
                    action=f"markdown_{int(best_md_tier * 100)}",
                    is_feasible=True,
                    expected_loss=round(best_md_loss, 2),
                    waste_avoided_kg=round(best_md_avoided_units * unit_weight_kg, 3),
                    cost_impact=round(best_md_giveaway, 2),
                    details={
                        "discount_pct": best_md_tier,
                        "elasticity": ELASTICITY_ASSUMPTION,
                        "cleared_units": best_md_avoided_units,
                        "markdown_giveaway": round(best_md_giveaway, 2),
                        "residual_waste_units": max(0, at_risk_units - best_md_avoided_units),
                    },
                )
            )
        else:
            options.append(
                ActionOptionScore(
                    action="markdown_20",
                    is_feasible=False,
                    expected_loss=round(loss_no_action, 2),
                    waste_avoided_kg=0.0,
                    cost_impact=0.0,
                    details={"reason": "Infeasible: No at-risk inventory to markdown"},
                )
            )

        # ----------------------------------------------------
        # 3. Option: donate (units with >= 1 day left before expiry)
        # ----------------------------------------------------
        donatable_units = 0
        for b in active_batches:
            exp = b["expiry_date"]
            if isinstance(exp, str):
                exp = date.fromisoformat(exp)
            if (exp - as_of).days >= 1:
                donatable_units += b["current_quantity"]
        donate_target = min(at_risk_units, donatable_units)
        donate_feasible = donate_target > 0

        if donate_feasible:
            # Loss = Cost of goods - Tax/CSR salvage recovery (20%)
            donate_loss = donate_target * unit_cost * (1.0 - DONATION_RECOVERY_RATE)
            residual_waste = max(0, at_risk_units - donate_target) * unit_cost
            total_donate_loss = donate_loss + residual_waste
            options.append(
                ActionOptionScore(
                    action="donate",
                    is_feasible=True,
                    expected_loss=round(total_donate_loss, 2),
                    waste_avoided_kg=round(donate_target * unit_weight_kg, 3),
                    cost_impact=round(donate_target * unit_cost, 2),
                    details={
                        "eligible_units": donate_target,
                        "recovery_rate": DONATION_RECOVERY_RATE,
                        "salvage_value": round(donate_target * unit_cost * DONATION_RECOVERY_RATE, 2),
                    },
                )
            )
        else:
            options.append(
                ActionOptionScore(
                    action="donate",
                    is_feasible=False,
                    expected_loss=round(loss_no_action, 2),
                    waste_avoided_kg=0.0,
                    cost_impact=0.0,
                    details={"reason": "Infeasible: No at-risk stock with >= 1 day shelf life"},
                )
            )

        # ----------------------------------------------------
        # 4. Option: transfer (transfer to store with quantified need)
        # ----------------------------------------------------
        best_target = None
        transfer_qty = 0
        for target in transfer_targets:
            if target.get("quantified_need", 0) > 0 and target["store_id"] != inputs.get("store_id"):
                best_target = target
                transfer_qty = min(at_risk_units, target["quantified_need"])
                break

        transfer_feasible = best_target is not None and transfer_qty > 0
        if transfer_feasible:
            transport_cost = transfer_qty * TRANSFER_COST_PER_UNIT
            # Saves waste at source, earns margin at target
            net_transfer_loss = transport_cost + max(0, at_risk_units - transfer_qty) * unit_cost
            options.append(
                ActionOptionScore(
                    action="transfer",
                    is_feasible=True,
                    expected_loss=round(net_transfer_loss, 2),
                    waste_avoided_kg=round(transfer_qty * unit_weight_kg, 3),
                    cost_impact=round(transport_cost, 2),
                    details={
                        "receiving_store_id": best_target["store_id"],
                        "receiving_store_name": best_target.get("store_name", "Destination"),
                        "transferred_units": transfer_qty,
                        "transport_cost": round(transport_cost, 2),
                    },
                )
            )
        else:
            options.append(
                ActionOptionScore(
                    action="transfer",
                    is_feasible=False,
                    expected_loss=round(loss_no_action, 2),
                    waste_avoided_kg=0.0,
                    cost_impact=0.0,
                    details={"reason": "Infeasible: No other store with quantified need"},
                )
            )

        # ----------------------------------------------------
        # 5. Option: replenish (ordering cost, lead time, MOQ)
        # ----------------------------------------------------
        # Constraint: CANNOT replenish into a high spoilage position!
        replenish_qty = inventory_analysis.get("suggested_replenish_qty", 0)
        replenish_feasible = (risk_level != "High") and replenish_qty > 0

        if replenish_feasible:
            ordering_cost = 15.0  # Fixed procurement administrative cost
            purchase_cost = replenish_qty * unit_cost
            # Expected loss reflects procurement commitment minus projected revenue margin
            expected_replenish_loss = ordering_cost + loss_no_action - (replenish_qty * unit_margin * 0.8)
            options.append(
                ActionOptionScore(
                    action="replenish",
                    is_feasible=True,
                    expected_loss=round(expected_replenish_loss, 2),
                    waste_avoided_kg=0.0,
                    cost_impact=round(purchase_cost + ordering_cost, 2),
                    details={
                        "replenish_qty": replenish_qty,
                        "ordering_cost": ordering_cost,
                        "purchase_cost": round(purchase_cost, 2),
                    },
                )
            )
        else:
            reason = "Infeasible: High spoilage risk position" if risk_level == "High" else "Infeasible: Stock is sufficient"
            options.append(
                ActionOptionScore(
                    action="replenish",
                    is_feasible=False,
                    expected_loss=round(loss_no_action, 2),
                    waste_avoided_kg=0.0,
                    cost_impact=0.0,
                    details={"reason": reason},
                )
            )

        return {"options": [opt.model_dump() for opt in options]}
