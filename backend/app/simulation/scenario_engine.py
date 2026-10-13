"""Scenario Simulator: Multi-policy evaluation comparing FIFO-only, Fixed-threshold, and Agentic replenishment."""
from copy import deepcopy
from datetime import date, timedelta
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from app.config import get_settings
from app.ml.forecasting import run_forecasting_pipeline
from app.ml.risk import evaluate_spoilage_risk
from app.models.schemas import ScenarioPolicyMetrics, ScenarioRunResult

# Standard Presets
PRESETS = {
    "demand_spike": {"demand_mult": 1.4, "shelf_life_mult": 1.0, "lead_time_add": 0, "stock_mult": 1.0, "variance_mult": 1.0},
    "supplier_delay": {"demand_mult": 1.0, "shelf_life_mult": 1.0, "lead_time_add": 4, "stock_mult": 1.0, "variance_mult": 1.0},
    "shorter_shelf_life": {"demand_mult": 1.0, "shelf_life_mult": 0.7, "lead_time_add": 0, "stock_mult": 1.0, "variance_mult": 1.0},
    "promotional_markdown": {"demand_mult": 0.75, "shelf_life_mult": 1.0, "lead_time_add": 0, "stock_mult": 1.0, "variance_mult": 1.0},
    "excess_inventory": {"demand_mult": 1.0, "shelf_life_mult": 1.0, "lead_time_add": 0, "stock_mult": 1.5, "variance_mult": 1.0},
    "store_variance": {"demand_mult": 1.0, "shelf_life_mult": 1.0, "lead_time_add": 0, "stock_mult": 1.0, "variance_mult": 1.5},
}


class SinglePolicySimulator:
    """Simulates inventory trajectory over a fixed horizon for a specific policy."""

    def __init__(
        self,
        policy_name: str,
        initial_batches: List[Dict[str, Any]],
        historical_sales: List[Tuple[date, int]],
        future_demands: List[int],
        product: Dict[str, Any],
        start_date: date,
        lead_time_days: int = 2,
    ):
        self.policy_name = policy_name
        self.batches = deepcopy(initial_batches)
        self.history = list(historical_sales)  # (date, units)
        self.future_demands = list(future_demands)
        self.product = dict(product)
        self.start_date = start_date
        self.lead_time_days = lead_time_days
        self.horizon_days = len(future_demands)

        self.unit_cost = float(product["unit_cost"])
        self.price = float(product["price"])
        self.unit_weight_kg = float(product["unit_weight_kg"])
        self.min_order_qty = int(product.get("min_order_qty", 10))

        # Metrics accumulators
        self.waste_units = 0
        self.stockout_units = 0
        self.total_demand = sum(future_demands)
        self.total_fulfilled = 0
        self.ordering_cost = 0.0
        self.markdown_cost = 0.0
        self.inventory_holding_cost = 0.0
        self.revenue = 0.0
        self.cogs = 0.0

        # In-transit orders: list of (arrival_day_idx, quantity)
        self.in_transit: List[Tuple[int, int]] = []

    def simulate(self) -> ScenarioPolicyMetrics:
        t0 = time.perf_counter()

        for day_idx in range(self.horizon_days):
            current_sim_date = self.start_date + timedelta(days=day_idx)
            demand_today = self.future_demands[day_idx]

            # 1. Receive incoming replenishment orders
            arrived_qty = sum(qty for arr_day, qty in self.in_transit if arr_day == day_idx)
            self.in_transit = [(arr_day, qty) for arr_day, qty in self.in_transit if arr_day > day_idx]
            if arrived_qty > 0:
                shelf_life = self.product.get("shelf_life_days", 7)
                self.batches.append({
                    "batch_code": f"ORD-ARR-{day_idx}",
                    "expiry_date": current_sim_date + timedelta(days=shelf_life),
                    "current_quantity": arrived_qty,
                    "unit_cost": self.unit_cost,
                })

            # 2. Check and record spoilage for expired batches (expiry < current_sim_date)
            for b in self.batches:
                if b["expiry_date"] < current_sim_date and b["current_quantity"] > 0:
                    self.waste_units += b["current_quantity"]
                    self.cogs += b["current_quantity"] * self.unit_cost
                    b["current_quantity"] = 0

            # Current on-hand
            on_hand = sum(b["current_quantity"] for b in self.batches if b["current_quantity"] > 0)

            # 3. Policy-Specific Replanning / Ordering / Markdown Action
            active_discount = 0.0

            if self.policy_name == "FIFO-only":
                # Static baseline: order MOQ every 4 days if stock < 15
                if day_idx % 4 == 0 and on_hand < 15:
                    order_qty = max(self.min_order_qty, 20)
                    self.in_transit.append((day_idx + self.lead_time_days, order_qty))
                    self.ordering_cost += 15.0
                    self.cogs += order_qty * self.unit_cost

            elif self.policy_name == "Fixed-threshold":
                # Fixed (s, S) policy: if on_hand < 12, order up to 35
                if on_hand < 12:
                    order_qty = max(self.min_order_qty, 35 - on_hand)
                    self.in_transit.append((day_idx + self.lead_time_days, order_qty))
                    self.ordering_cost += 15.0
                    self.cogs += order_qty * self.unit_cost
                # Fixed rule: markdown 20% if any batch has <= 2 days left
                near_exp = any(
                    (b["expiry_date"] - current_sim_date).days <= 2 and b["current_quantity"] > 0
                    for b in self.batches
                )
                if near_exp:
                    active_discount = 0.20

            elif self.policy_name == "Agentic":
                # STRICT NO-LOOK-AHEAD:
                # Agent replans using ONLY history available up to yesterday (day_idx - 1)!
                available_history = [h for h in self.history if h[0] < current_sim_date]

                # Run forecasting on past history only
                fc = run_forecasting_pipeline(
                    sales_series=available_history,
                    horizon_days=7,
                    as_of_date=current_sim_date,
                )

                # Assess spoilage risk
                risk = evaluate_spoilage_risk(
                    batches=self.batches,
                    forecast=fc,
                    as_of_date=current_sim_date,
                )

                # Replenish decision: order only if understocked AND risk is not High
                avg_forecast = float(np.mean(fc.point_forecast)) if fc.point_forecast else 5.0
                reorder_threshold = int(round(avg_forecast * (self.lead_time_days + 1)))

                if on_hand < reorder_threshold and risk.risk_level != "High":
                    needed = int(round(avg_forecast * (self.lead_time_days + 3))) - on_hand
                    order_qty = max(self.min_order_qty, needed)
                    self.in_transit.append((day_idx + self.lead_time_days, order_qty))
                    self.ordering_cost += 15.0
                    self.cogs += order_qty * self.unit_cost

                # Markdown decision: proactive markdown if High spoilage risk
                if risk.risk_level == "High" and risk.at_risk_units > 0:
                    active_discount = 0.30
                elif risk.risk_level == "Medium" and risk.at_risk_units > 0:
                    active_discount = 0.15

            # 4. Fulfill today's customer demand
            effective_demand = demand_today
            if active_discount > 0:
                # Demand uplift under price elasticity 1.5
                effective_demand = int(round(demand_today * (1.0 + 1.5 * active_discount)))

            # FIFO depletion from oldest batches
            rem_dem = effective_demand
            self.batches.sort(key=lambda b: b["expiry_date"])
            sold_today = 0

            for b in self.batches:
                if rem_dem <= 0:
                    break
                if b["current_quantity"] > 0 and b["expiry_date"] >= current_sim_date:
                    fulfill = min(b["current_quantity"], rem_dem)
                    b["current_quantity"] -= fulfill
                    sold_today += fulfill
                    rem_dem -= fulfill

            # Record sales & stockouts
            self.total_fulfilled += sold_today
            if rem_dem > 0:
                self.stockout_units += rem_dem

            sale_price = self.price * (1.0 - active_discount)
            self.revenue += sold_today * sale_price
            if active_discount > 0:
                self.markdown_cost += sold_today * (self.price * active_discount)

            # Record end-of-day history for future days
            self.history.append((current_sim_date, sold_today))

            # Holding cost: $0.05 per unit on hand
            eod_stock = sum(b["current_quantity"] for b in self.batches)
            self.inventory_holding_cost += eod_stock * 0.05

        # Final end-of-horizon expiry check
        final_cutoff = self.start_date + timedelta(days=self.horizon_days)
        for b in self.batches:
            if b["expiry_date"] <= final_cutoff and b["current_quantity"] > 0:
                self.waste_units += b["current_quantity"]
                self.cogs += b["current_quantity"] * self.unit_cost
                b["current_quantity"] = 0

        runtime_ms = round((time.perf_counter() - t0) * 1000, 2)
        waste_cost = round(self.waste_units * self.unit_cost, 2)
        service_level = round((self.total_fulfilled / self.total_demand) * 100, 2) if self.total_demand > 0 else 100.0
        net_margin = round(self.revenue - self.cogs - self.ordering_cost - self.inventory_holding_cost, 2)

        return ScenarioPolicyMetrics(
            policy_name=self.policy_name,
            waste_units=float(self.waste_units),
            waste_cost=waste_cost,
            stockout_units=float(self.stockout_units),
            service_level_pct=service_level,
            inventory_cost=round(self.inventory_holding_cost, 2),
            ordering_cost=round(self.ordering_cost, 2),
            markdown_cost=round(self.markdown_cost, 2),
            net_margin=net_margin,
            runtime_ms=runtime_ms,
        )


def run_multi_seed_scenario(
    preset_name: str,
    seeds_count: int = 5,
    horizon_days: int = 14,
    as_of_date_str: Optional[str] = None,
    product: Optional[Dict[str, Any]] = None,
    historical_sales: Optional[List[Tuple[date, int]]] = None,
    initial_batches: Optional[List[Dict[str, Any]]] = None,
) -> ScenarioRunResult:
    """Run scenario across seeds comparing FIFO-only, Fixed-threshold, and Agentic policies on identical inputs."""
    settings = get_settings()
    preset = PRESETS.get(preset_name, PRESETS["demand_spike"])

    # Multi-seed cap: 20 locally, capped at 5 in PRODUCTION
    is_prod = settings.is_production
    actual_seeds = min(seeds_count, 5) if is_prod else min(seeds_count, 20)
    capped = actual_seeds < seeds_count

    as_of = date.fromisoformat(as_of_date_str or settings.AS_OF_DATE)

    # Defaults if not supplied from DB
    prod_data = product or {
        "sku": "DAI-001",
        "name": "Organic Whole Milk 1L",
        "unit_cost": 1.20,
        "price": 2.49,
        "shelf_life_days": int(round(10 * preset["shelf_life_mult"])),
        "unit_weight_kg": 1.030,
        "min_order_qty": 15,
        "supplier_lead_time_days": 2 + preset["lead_time_add"],
    }

    base_batches = initial_batches or [
        {"batch_code": "INIT-B1", "expiry_date": as_of + timedelta(days=2), "current_quantity": int(round(25 * preset["stock_mult"])), "unit_cost": prod_data["unit_cost"]},
        {"batch_code": "INIT-B2", "expiry_date": as_of + timedelta(days=5), "current_quantity": int(round(30 * preset["stock_mult"])), "unit_cost": prod_data["unit_cost"]},
        {"batch_code": "INIT-B3", "expiry_date": as_of + timedelta(days=8), "current_quantity": int(round(20 * preset["stock_mult"])), "unit_cost": prod_data["unit_cost"]},
    ]

    base_history = historical_sales or [
        (as_of - timedelta(days=d), int(round(max(5, 18 + 5 * np.sin(d / 7.0)))))
        for d in range(84, 0, -1)
    ]

    policy_names = ["FIFO-only", "Fixed-threshold", "Agentic"]
    policy_runs: Dict[str, List[ScenarioPolicyMetrics]] = {p: [] for p in policy_names}

    for seed_idx in range(actual_seeds):
        rng = np.random.default_rng(seed=100 + seed_idx)

        # Generate future demand for the horizon (IDENTICAL FOR ALL POLICIES IN THIS SEED)
        future_demands = []
        for h in range(horizon_days):
            mean_d = 20.0 * preset["demand_mult"]
            noise_std = np.sqrt(mean_d) * preset["variance_mult"]
            d_val = max(1, int(round(rng.normal(mean_d, noise_std))))
            future_demands.append(d_val)

        # Run all 3 policies with identical starting batches and identical customer demands
        for p_name in policy_names:
            sim = SinglePolicySimulator(
                policy_name=p_name,
                initial_batches=base_batches,
                historical_sales=base_history,
                future_demands=future_demands,
                product=prod_data,
                start_date=as_of,
                lead_time_days=prod_data["supplier_lead_time_days"],
            )
            metrics = sim.simulate()
            policy_runs[p_name].append(metrics)

    # Compute aggregated mean, min, max per policy
    aggregated: List[Dict[str, Any]] = []
    baseline_waste_mean = np.mean([m.waste_units for m in policy_runs["FIFO-only"]])

    for p_name in policy_names:
        runs = policy_runs[p_name]
        w_units = [m.waste_units for m in runs]
        w_cost = [m.waste_cost for m in runs]
        stockouts = [m.stockout_units for m in runs]
        serv_levels = [m.service_level_pct for m in runs]
        margins = [m.net_margin for m in runs]
        runtimes = [m.runtime_ms for m in runs]

        mean_w_units = float(np.mean(w_units))
        # Reduction relative to FIFO baseline
        if baseline_waste_mean < 0.5:
            waste_red_str = "n/a"
        else:
            pct_val = round(((baseline_waste_mean - mean_w_units) / baseline_waste_mean) * 100, 1)
            waste_red_str = f"{pct_val}%"

        aggregated.append({
            "policy_name": p_name,
            "waste_units_mean": round(mean_w_units, 2),
            "waste_units_min": round(float(np.min(w_units)), 2),
            "waste_units_max": round(float(np.max(w_units)), 2),
            "waste_cost_mean": round(float(np.mean(w_cost)), 2),
            "waste_cost_min": round(float(np.min(w_cost)), 2),
            "waste_cost_max": round(float(np.max(w_cost)), 2),
            "stockout_units_mean": round(float(np.mean(stockouts)), 2),
            "stockout_units_min": round(float(np.min(stockouts)), 2),
            "stockout_units_max": round(float(np.max(stockouts)), 2),
            "service_level_pct_mean": round(float(np.mean(serv_levels)), 2),
            "service_level_pct_min": round(float(np.min(serv_levels)), 2),
            "service_level_pct_max": round(float(np.max(serv_levels)), 2),
            "net_margin_mean": round(float(np.mean(margins)), 2),
            "net_margin_min": round(float(np.min(margins)), 2),
            "net_margin_max": round(float(np.max(margins)), 2),
            "runtime_ms_mean": round(float(np.mean(runtimes)), 2),
            "waste_reduction_pct": waste_red_str,
        })

    return ScenarioRunResult(
        preset_name=preset_name,
        seeds_requested=seeds_count,
        seeds_run=actual_seeds,
        seeds_capped=capped,
        horizon_days=horizon_days,
        policy_results=aggregated,
    )
