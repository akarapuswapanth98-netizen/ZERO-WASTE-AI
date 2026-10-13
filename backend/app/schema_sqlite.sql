-- ZeroWaste AI Schema DDL (SQLite Variant)

CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    square_meters INT NOT NULL DEFAULT 500,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_cost REAL NOT NULL,
    price REAL NOT NULL,
    shelf_life_days INT NOT NULL,
    unit_weight_kg REAL NOT NULL,
    supplier_lead_time_days INT NOT NULL DEFAULT 2,
    min_order_qty INT NOT NULL DEFAULT 10,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_code TEXT NOT NULL,
    received_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    initial_quantity INT NOT NULL,
    current_quantity INT NOT NULL,
    unit_cost REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_store_product_batch UNIQUE (store_id, product_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_lookup ON inventory_batches(store_id, product_id, expiry_date);

CREATE TABLE IF NOT EXISTS sales_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sale_date TEXT NOT NULL,
    units_sold INT NOT NULL,
    unit_price REAL NOT NULL,
    promotions_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_store_product_saledate UNIQUE (store_id, product_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_sales_history_lookup ON sales_history(store_id, product_id, sale_date);

CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    store_id INT REFERENCES stores(id) ON DELETE SET NULL,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    agent_name TEXT NOT NULL,
    inputs_json TEXT NOT NULL,
    outputs_json TEXT NOT NULL,
    execution_time_ms REAL NOT NULL,
    validation_passed INTEGER NOT NULL DEFAULT 1,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_timestamp ON agent_runs(run_timestamp DESC);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INT REFERENCES agent_runs(id) ON DELETE SET NULL,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    proposed_action TEXT NOT NULL,
    proposed_quantity INT NOT NULL,
    current_stock INT NOT NULL,
    expiry_date TEXT,
    forecast_demand REAL NOT NULL,
    risk_level TEXT NOT NULL,
    risk_ratio REAL NOT NULL,
    expected_loss REAL NOT NULL,
    waste_avoided_kg REAL NOT NULL,
    cost_impact REAL NOT NULL,
    alternatives_json TEXT NOT NULL,
    explanation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommendations_store_sku ON recommendations(store_id, product_id, status);

CREATE TABLE IF NOT EXISTS planner_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id INT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    approved_quantity INT NOT NULL,
    reason TEXT,
    decided_by TEXT NOT NULL DEFAULT 'planner',
    execution_status TEXT NOT NULL,
    execution_result_json TEXT,
    decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_planner_decisions_rec ON planner_decisions(recommendation_id);

CREATE TABLE IF NOT EXISTS sim_system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sim_events_sys ON sim_system_events(system_name, timestamp DESC);

CREATE TABLE IF NOT EXISTS scenario_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_name TEXT NOT NULL,
    seed INT NOT NULL,
    horizon_days INT NOT NULL,
    policy_name TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scenario_runs_preset ON scenario_runs(preset_name, seed);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INT,
    actor TEXT NOT NULL,
    details_json TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
