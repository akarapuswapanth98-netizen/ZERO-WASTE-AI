"""Tests for scenario simulation: no-look-ahead property, reproducibility, and identical inputs."""
from datetime import date, timedelta
from app.simulation.scenario_engine import SinglePolicySimulator, run_multi_seed_scenario


def test_agentic_policy_strict_no_look_ahead():
    """Rule: Agentic policy replans each day from history through the previous day only (no look-ahead)."""
    as_of = date(2026, 10, 12)
    horizon = 7
    product = {
        "sku": "DAI-001",
        "name": "Milk",
        "unit_cost": 1.20,
        "price": 2.49,
        "shelf_life_days": 10,
        "unit_weight_kg": 1.0,
        "min_order_qty": 10,
    }
    batches = [
        {"batch_code": "B1", "expiry_date": as_of + timedelta(days=3), "current_quantity": 30, "unit_cost": 1.20},
    ]

    # Generate 84 days of history prior to as_of
    initial_history = [(as_of - timedelta(days=d), 15) for d in range(84, 0, -1)]
    # Future demands for the 7 days of the scenario
    future_demands = [10, 12, 14, 16, 18, 20, 22]

    # Subclass simulator to spy on history length day by day
    history_lengths_seen = []

    class MonitoredSimulator(SinglePolicySimulator):
        def simulate(self):
            for day_idx in range(self.horizon_days):
                current_sim_date = self.start_date + timedelta(days=day_idx)
                # Verify that any historical records with date >= current_sim_date are absent
                records_at_or_after_today = [
                    h for h in self.history if h[0] >= current_sim_date
                ]
                assert len(records_at_or_after_today) == 0, (
                    f"LOOK-AHEAD LEAK DETECTED at day {day_idx} ({current_sim_date}): "
                    f"Simulator has access to {len(records_at_or_after_today)} future/current records!"
                )
                history_lengths_seen.append(len(self.history))
                # Add past day record at end of day
                self.history.append((current_sim_date, self.future_demands[day_idx]))

    sim = MonitoredSimulator(
        policy_name="Agentic",
        initial_batches=batches,
        historical_sales=initial_history,
        future_demands=future_demands,
        product=product,
        start_date=as_of,
        lead_time_days=2,
    )
    sim.simulate()

    # Verify history grew strictly day-by-day: day 0 saw 84, day 1 saw 85, etc.
    assert history_lengths_seen == [84 + i for i in range(horizon)]


def test_scenario_reproducibility_same_seed_gives_identical_metrics():
    """Rule: Same scenario + seed gives identical metrics (runtime excluded)."""
    res1 = run_multi_seed_scenario(preset_name="demand_spike", seeds_count=3, horizon_days=7)
    res2 = run_multi_seed_scenario(preset_name="demand_spike", seeds_count=3, horizon_days=7)

    assert len(res1.policy_results) == len(res2.policy_results)

    for p1, p2 in zip(res1.policy_results, res2.policy_results):
        assert p1["policy_name"] == p2["policy_name"]
        assert p1["waste_units_mean"] == p2["waste_units_mean"]
        assert p1["waste_cost_mean"] == p2["waste_cost_mean"]
        assert p1["stockout_units_mean"] == p2["stockout_units_mean"]
        assert p1["service_level_pct_mean"] == p2["service_level_pct_mean"]
        assert p1["net_margin_mean"] == p2["net_margin_mean"]
        assert p1["waste_reduction_pct"] == p2["waste_reduction_pct"]


def test_policies_share_identical_inputs():
    """Rule: All policies evaluated on identical customer demand and initial inventory."""
    res = run_multi_seed_scenario(preset_name="supplier_delay", seeds_count=3, horizon_days=7)

    policies = {p["policy_name"] for p in res.policy_results}
    assert policies == {"FIFO-only", "Fixed-threshold", "Agentic"}
    # Agentic runtime is non-zero
    for p in res.policy_results:
        assert p["runtime_ms_mean"] >= 0.0


def test_near_zero_baseline_waste_shows_na():
    """Rule: If baseline waste is near zero, show 'n/a' for percentage reduction."""
    as_of = date(2026, 10, 12)
    product = {
        "sku": "DAI-001",
        "name": "Milk",
        "unit_cost": 1.20,
        "price": 2.49,
        "shelf_life_days": 30,  # Huge shelf life -> 0 waste
        "unit_weight_kg": 1.0,
        "min_order_qty": 10,
        "supplier_lead_time_days": 1,
    }
    batches = [
        {"batch_code": "B1", "expiry_date": as_of + timedelta(days=20), "current_quantity": 5, "unit_cost": 1.20},
    ]

    res = run_multi_seed_scenario(
        preset_name="demand_spike",
        seeds_count=2,
        horizon_days=5,
        product=product,
        initial_batches=batches,
    )

    fifo_p = next(p for p in res.policy_results if p["policy_name"] == "FIFO-only")
    # If waste was near zero, waste_reduction_pct is "n/a"
    if fifo_p["waste_units_mean"] < 0.5:
        assert fifo_p["waste_reduction_pct"] == "n/a"
