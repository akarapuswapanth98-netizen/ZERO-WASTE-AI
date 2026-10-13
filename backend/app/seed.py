"""Deterministic, reproducible seed data generator (Seed 42) for ZeroWaste AI."""
from datetime import date, timedelta
import random
from typing import Dict, List, Optional, Tuple
import numpy as np
from app.config import get_settings
from app.database import get_db_cursor, is_sqlite
from app.schema import apply_schema

# 5 Defined Stores
STORES_DATA = [
    {"code": "STR-001", "name": "Metro Flagship", "location": "Downtown Central", "square_meters": 1200},
    {"code": "STR-002", "name": "Suburban Fresh", "location": "North Suburbs", "square_meters": 850},
    {"code": "STR-003", "name": "Midtown Express", "location": "Financial District", "square_meters": 450},
    {"code": "STR-004", "name": "Westside Market", "location": "West Residential", "square_meters": 750},
    {"code": "STR-005", "name": "Harbor Grocers", "location": "Harborfront Quay", "square_meters": 600},
]

# 18 Defined Perishable SKUs across 6 Categories
PRODUCTS_DATA = [
    # Dairy (shelf life 7 - 14 days)
    {"sku": "DAI-001", "name": "Organic Whole Milk 1L", "category": "dairy", "unit_cost": 1.20, "price": 2.49, "shelf_life_days": 10, "unit_weight_kg": 1.030, "lead_time": 1, "moq": 20},
    {"sku": "DAI-002", "name": "Greek Yogurt Plain 500g", "category": "dairy", "unit_cost": 1.80, "price": 3.99, "shelf_life_days": 14, "unit_weight_kg": 0.520, "lead_time": 2, "moq": 15},
    {"sku": "DAI-003", "name": "Artisan Farm Cheddar 250g", "category": "dairy", "unit_cost": 2.90, "price": 5.49, "shelf_life_days": 21, "unit_weight_kg": 0.260, "lead_time": 2, "moq": 10},
    # Bakery (shelf life 3 - 5 days)
    {"sku": "BAK-001", "name": "Artisan Sourdough Boule", "category": "bakery", "unit_cost": 1.10, "price": 3.49, "shelf_life_days": 3, "unit_weight_kg": 0.500, "lead_time": 1, "moq": 12},
    {"sku": "BAK-002", "name": "Butter Croissant 4-Pack", "category": "bakery", "unit_cost": 1.60, "price": 4.29, "shelf_life_days": 4, "unit_weight_kg": 0.280, "lead_time": 1, "moq": 10},
    {"sku": "BAK-003", "name": "Brioche Burger Buns 4-Pk", "category": "bakery", "unit_cost": 1.30, "price": 3.79, "shelf_life_days": 5, "unit_weight_kg": 0.350, "lead_time": 1, "moq": 15},
    # Produce (shelf life 4 - 8 days)
    {"sku": "PRO-001", "name": "Organic Strawberries 250g", "category": "produce", "unit_cost": 1.70, "price": 3.99, "shelf_life_days": 4, "unit_weight_kg": 0.260, "lead_time": 1, "moq": 16},
    {"sku": "PRO-002", "name": "Baby Spinach Clamshell 200g", "category": "produce", "unit_cost": 1.25, "price": 2.99, "shelf_life_days": 6, "unit_weight_kg": 0.220, "lead_time": 1, "moq": 20},
    {"sku": "PRO-003", "name": "Hass Avocados 4-Pack", "category": "produce", "unit_cost": 2.10, "price": 4.99, "shelf_life_days": 7, "unit_weight_kg": 0.600, "lead_time": 2, "moq": 12},
    # Meat (shelf life 4 - 7 days)
    {"sku": "MEA-001", "name": "Free-Range Chicken Breast 500g", "category": "meat", "unit_cost": 3.80, "price": 7.49, "shelf_life_days": 5, "unit_weight_kg": 0.520, "lead_time": 1, "moq": 10},
    {"sku": "MEA-002", "name": "Grass-Fed Ribeye Steak 300g", "category": "meat", "unit_cost": 6.50, "price": 12.99, "shelf_life_days": 6, "unit_weight_kg": 0.320, "lead_time": 2, "moq": 8},
    {"sku": "MEA-003", "name": "Lean Ground Beef 450g", "category": "meat", "unit_cost": 3.20, "price": 6.29, "shelf_life_days": 5, "unit_weight_kg": 0.460, "lead_time": 1, "moq": 12},
    # Seafood (shelf life 3 - 5 days)
    {"sku": "SEA-001", "name": "Atlantic Salmon Fillet 400g", "category": "seafood", "unit_cost": 5.20, "price": 10.99, "shelf_life_days": 4, "unit_weight_kg": 0.420, "lead_time": 1, "moq": 8},
    {"sku": "SEA-002", "name": "Wild Tiger Prawns 300g", "category": "seafood", "unit_cost": 4.80, "price": 9.99, "shelf_life_days": 4, "unit_weight_kg": 0.320, "lead_time": 2, "moq": 8},
    {"sku": "SEA-003", "name": "Fresh Sea Bass Portions 350g", "category": "seafood", "unit_cost": 4.50, "price": 9.49, "shelf_life_days": 5, "unit_weight_kg": 0.360, "lead_time": 2, "moq": 6},
    # Ready-to-eat (shelf life 2 - 4 days)
    {"sku": "RTE-001", "name": "Chicken Caesar Salad 350g", "category": "ready-to-eat", "unit_cost": 2.60, "price": 5.99, "shelf_life_days": 3, "unit_weight_kg": 0.360, "lead_time": 1, "moq": 10},
    {"sku": "RTE-002", "name": "Sushi Bento Box 320g", "category": "ready-to-eat", "unit_cost": 4.10, "price": 8.99, "shelf_life_days": 2, "unit_weight_kg": 0.340, "lead_time": 1, "moq": 8},
    {"sku": "RTE-003", "name": "Artisan Club Wrap 280g", "category": "ready-to-eat", "unit_cost": 2.20, "price": 5.49, "shelf_life_days": 3, "unit_weight_kg": 0.290, "lead_time": 1, "moq": 12},
]


def seed_database(
    database_url: Optional[str] = None,
    seed: int = 42,
    as_of_date_str: Optional[str] = None,
    force_reset: bool = False,
) -> Dict[str, int]:
    """Populate database with deterministic synthetic data (Seed 42)."""
    apply_schema(database_url)
    as_of = date.fromisoformat(as_of_date_str or get_settings().AS_OF_DATE)
    rng = np.random.default_rng(seed)

    with get_db_cursor(database_url) as cur:
        if force_reset:
            if is_sqlite(database_url):
                for tbl in ["planner_decisions", "recommendations", "agent_runs", "inventory_batches", "sales_history", "products", "stores", "sim_system_events", "scenario_runs", "audit_logs"]:
                    cur.execute(f"DELETE FROM {tbl};")
            else:
                cur.execute("TRUNCATE planner_decisions, recommendations, agent_runs, inventory_batches, sales_history, products, stores, sim_system_events, scenario_runs, audit_logs CASCADE;")
        else:
            cur.execute("SELECT COUNT(*) FROM stores;")
            if cur.fetchone()[0] >= 5:
                # Already seeded
                return {"status": "already_seeded"}

        # 1. Insert Stores
        store_records = []
        for s in STORES_DATA:
            cur.execute(
                """
                INSERT INTO stores (code, name, location, square_meters)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                RETURNING id, code;
                """,
                (s["code"], s["name"], s["location"], s["square_meters"]),
            )
            store_records.append(cur.fetchone())
        store_map = {row[1]: row[0] for row in store_records}

        # 2. Insert Products
        product_records = []
        for p in PRODUCTS_DATA:
            cur.execute(
                """
                INSERT INTO products (sku, name, category, unit_cost, price, shelf_life_days, unit_weight_kg, supplier_lead_time_days, min_order_qty)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (sku) DO UPDATE SET price = EXCLUDED.price
                RETURNING id, sku;
                """,
                (
                    p["sku"],
                    p["name"],
                    p["category"],
                    p["unit_cost"],
                    p["price"],
                    p["shelf_life_days"],
                    p["unit_weight_kg"],
                    p["lead_time"],
                    p["moq"],
                ),
            )
            product_records.append(cur.fetchone())
        product_map = {row[1]: row[0] for row in product_records}

        # 3. Generate 12 weeks (84 days) of sales history per (store, product)
        # Dates: from (as_of - 84 days) to (as_of - 1 day)
        start_date = as_of - timedelta(days=84)
        sales_to_insert = []
        
        # Store traffic multipliers (Metro Flagship highest, Midtown Express compact)
        store_multipliers = {
            "STR-001": 1.4,
            "STR-002": 1.1,
            "STR-003": 0.85,
            "STR-004": 1.0,
            "STR-005": 0.9,
        }

        # Product base demand per category
        cat_base_demand = {
            "dairy": 25.0,
            "bakery": 20.0,
            "produce": 22.0,
            "meat": 14.0,
            "seafood": 9.0,
            "ready-to-eat": 18.0,
        }

        for s in STORES_DATA:
            store_id = store_map[s["code"]]
            s_mult = store_multipliers[s["code"]]

            for p in PRODUCTS_DATA:
                product_id = product_map[p["sku"]]
                base_d = cat_base_demand[p["category"]] * s_mult

                for day_idx in range(84):
                    cur_date = start_date + timedelta(days=day_idx)
                    weekday = cur_date.weekday()  # 0=Mon, 6=Sun

                    # Day of week multiplier (surge on Fri/Sat/Sun)
                    dow_mult = 1.0
                    if weekday in (4, 5):  # Fri, Sat
                        dow_mult = 1.35
                    elif weekday == 6:  # Sun
                        dow_mult = 1.2
                    elif weekday == 0:  # Mon
                        dow_mult = 0.85

                    # Payday effect: 1st and 15th of each month (+25% boost)
                    payday_mult = 1.25 if cur_date.day in (1, 15) else 1.0

                    # Stochastic noise from Poisson / Gaussian
                    expected = base_d * dow_mult * payday_mult
                    units = int(max(0, np.round(rng.normal(expected, np.sqrt(expected) * 0.9))))

                    sales_to_insert.append((
                        store_id,
                        product_id,
                        cur_date,
                        units,
                        p["price"],
                        False,
                    ))

        # Fast batch insert for sales history
        cur.executemany(
            """
            INSERT INTO sales_history (store_id, product_id, sale_date, units_sold, unit_price, promotions_active)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (store_id, product_id, sale_date) DO NOTHING;
            """,
            sales_to_insert,
        )

        # 4. Generate 2-4 Batches per (store, product) with deliberate imbalances
        # Some expiring in 1-2 days (critical near-expiry), some fresh, some overstocked
        batches_to_insert = []
        batch_counter = 1000

        for s in STORES_DATA:
            store_id = store_map[s["code"]]
            s_code = s["code"]

            for p in PRODUCTS_DATA:
                product_id = product_map[p["sku"]]
                shelf_life = p["shelf_life_days"]
                cost = p["unit_cost"]

                # Intentional deliberate imbalances:
                # Metro Flagship has deliberate overstock on Bakery & Ready-to-eat
                # Midtown Express has deliberate near-expiry on Dairy & Seafood
                # Harbor Grocers has shortage on Meat
                is_overstock = (s_code == "STR-001" and p["category"] in ("bakery", "ready-to-eat")) or (s_code == "STR-004" and p["category"] == "produce")
                is_near_expiry = (s_code == "STR-003" and p["category"] in ("dairy", "seafood")) or (s_code == "STR-002" and p["category"] == "meat")
                is_shortage = (s_code == "STR-005" and p["category"] == "meat")

                num_batches = 2 if is_shortage else (4 if is_overstock else 3)

                for b_i in range(num_batches):
                    batch_counter += 1
                    batch_code = f"BAT-{batch_counter}"

                    if is_near_expiry and b_i == 0:
                        # Expiring in 1-2 days!
                        days_left = rng.integers(1, 3)
                        received_offset = shelf_life - days_left
                        qty = int(rng.integers(25, 45))  # High qty expiring soon -> clear spoilage risk!
                    elif is_overstock:
                        days_left = rng.integers(2, shelf_life + 1)
                        received_offset = max(1, shelf_life - days_left)
                        qty = int(rng.integers(40, 70))  # Significant overstock
                    elif is_shortage:
                        days_left = rng.integers(3, shelf_life + 1)
                        received_offset = 1
                        qty = int(rng.integers(2, 6))  # Critical stockout danger
                    else:
                        days_left = rng.integers(2, shelf_life + 1)
                        received_offset = max(1, shelf_life - days_left)
                        qty = int(rng.integers(12, 28))

                    expiry_d = as_of + timedelta(days=int(days_left))
                    recv_d = as_of - timedelta(days=int(received_offset))

                    batches_to_insert.append((
                        store_id,
                        product_id,
                        batch_code,
                        recv_d,
                        expiry_d,
                        qty,
                        qty,
                        cost,
                    ))

        # Fast batch insert for inventory batches
        cur.executemany(
            """
            INSERT INTO inventory_batches (store_id, product_id, batch_code, received_date, expiry_date, initial_quantity, current_quantity, unit_cost)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (store_id, product_id, batch_code) DO NOTHING;
            """,
            batches_to_insert,
        )

    # 5. Populate initial proposals & demo decisions so Planner and Evaluation queues are populated immediately
    try:
        _seed_demo_proposals(database_url)
    except Exception:
        pass

    return {
        "status": "seeded",
        "stores_count": len(STORES_DATA),
        "products_count": len(PRODUCTS_DATA),
        "sales_records_count": len(sales_to_insert),
        "batches_count": len(batches_to_insert),
    }


def _seed_demo_proposals(database_url: Optional[str] = None) -> None:
    """Generate initial agent proposals and decisions so Planner and Evaluation queues are populated."""
    from app.routers.agents import run_pipeline_for_item
    from app.simulation.scenario_engine import run_multi_seed_scenario
    import json

    with get_db_cursor(database_url) as cur:
        cur.execute("SELECT COUNT(*) FROM recommendations;")
        if cur.fetchone()[0] > 0:
            return

        cur.execute("SELECT id FROM stores ORDER BY id ASC;")
        store_ids = [r[0] for r in cur.fetchall()]
        cur.execute("SELECT id FROM products ORDER BY id ASC;")
        product_ids = [r[0] for r in cur.fetchall()]

    rec_ids = []
    for sid in store_ids:
        for pid in product_ids:
            try:
                prop = run_pipeline_for_item(sid, pid, horizon_days=7)
                rec_ids.append(prop.id)
            except Exception:
                pass

    if not rec_ids:
        return

    # Mark first proposal as approved & executed (seeded demo history)
    with get_db_cursor(database_url) as cur:
        first_id = rec_ids[0]
        cur.execute("UPDATE recommendations SET status = 'executed' WHERE id = %s;", (first_id,))
        cur.execute(
            """
            INSERT INTO planner_decisions (recommendation_id, decision, approved_quantity, reason, decided_by, execution_status, decided_at)
            VALUES (%s, 'approved', 15, 'Approved by planner (Initial seeded demo history)', 'planner', 'executed', CURRENT_TIMESTAMP);
            """,
            (first_id,),
        )
        cur.execute(
            """
            INSERT INTO audit_logs (action_type, entity_type, entity_id, actor, details_json, timestamp)
            VALUES ('decision_approved', 'recommendation', %s, 'planner', %s, CURRENT_TIMESTAMP);
            """,
            (first_id, json.dumps({"decision": "approved", "note": "Initial seeded demo history"})),
        )

        if len(rec_ids) > 1:
            second_id = rec_ids[1]
            cur.execute("UPDATE recommendations SET status = 'rejected' WHERE id = %s;", (second_id,))
            cur.execute(
                """
                INSERT INTO planner_decisions (recommendation_id, decision, approved_quantity, reason, decided_by, execution_status, decided_at)
                VALUES (%s, 'rejected', 0, 'Declined due to supplier rebate terms (Initial seeded demo history)', 'planner', 'rejected_no_action', CURRENT_TIMESTAMP);
                """,
                (second_id,),
            )
            cur.execute(
                """
                INSERT INTO audit_logs (action_type, entity_type, entity_id, actor, details_json, timestamp)
                VALUES ('decision_rejected', 'recommendation', %s, 'planner', %s, CURRENT_TIMESTAMP);
                """,
                (second_id, json.dumps({"decision": "rejected", "note": "Initial seeded demo history"})),
            )

    # Run baseline scenario simulation to populate scenario_runs
    try:
        sim_res = run_multi_seed_scenario(preset_name="demand_spike", seeds_count=5, horizon_days=14)
        with get_db_cursor(database_url) as cur:
            for p_res in sim_res.policy_results:
                cur.execute(
                    """
                    INSERT INTO scenario_runs (preset_name, seed, horizon_days, policy_name, metrics_json)
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    (
                        "demand_spike",
                        5,
                        14,
                        p_res["policy_name"],
                        json.dumps(p_res),
                    ),
                )
    except Exception:
        pass

