-- ZeroWaste AI Schema DDL (Idempotent)

CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    location VARCHAR(128) NOT NULL,
    square_meters INT NOT NULL DEFAULT 500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    shelf_life_days INT NOT NULL,
    unit_weight_kg NUMERIC(8, 3) NOT NULL,
    supplier_lead_time_days INT NOT NULL DEFAULT 2,
    min_order_qty INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS inventory_batches (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_code VARCHAR(64) NOT NULL,
    received_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    initial_quantity INT NOT NULL,
    current_quantity INT NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_store_product_batch UNIQUE (store_id, product_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_lookup ON inventory_batches(store_id, product_id, expiry_date);

CREATE TABLE IF NOT EXISTS sales_history (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sale_date DATE NOT NULL,
    units_sold INT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    promotions_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_store_product_saledate UNIQUE (store_id, product_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_sales_history_lookup ON sales_history(store_id, product_id, sale_date);

CREATE TABLE IF NOT EXISTS agent_runs (
    id SERIAL PRIMARY KEY,
    run_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    store_id INT REFERENCES stores(id) ON DELETE SET NULL,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    agent_name VARCHAR(64) NOT NULL,
    inputs_json JSONB NOT NULL,
    outputs_json JSONB NOT NULL,
    execution_time_ms NUMERIC(10, 2) NOT NULL,
    validation_passed BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_timestamp ON agent_runs(run_timestamp DESC);

CREATE TABLE IF NOT EXISTS recommendations (
    id SERIAL PRIMARY KEY,
    run_id INT REFERENCES agent_runs(id) ON DELETE SET NULL,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    proposed_action VARCHAR(32) NOT NULL, -- replenish, markdown, transfer, donate, no_action
    proposed_quantity INT NOT NULL,
    current_stock INT NOT NULL,
    expiry_date DATE,
    forecast_demand NUMERIC(10, 2) NOT NULL,
    risk_level VARCHAR(16) NOT NULL,     -- Low, Medium, High
    risk_ratio NUMERIC(6, 4) NOT NULL,
    expected_loss NUMERIC(10, 2) NOT NULL,
    waste_avoided_kg NUMERIC(10, 3) NOT NULL,
    cost_impact NUMERIC(10, 2) NOT NULL,
    alternatives_json JSONB NOT NULL,     -- Ranked options with scoring details
    explanation TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, executed, failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommendations_store_sku ON recommendations(store_id, product_id, status);

CREATE TABLE IF NOT EXISTS planner_decisions (
    id SERIAL PRIMARY KEY,
    recommendation_id INT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    decision VARCHAR(32) NOT NULL,        -- approved, rejected
    approved_quantity INT NOT NULL,
    reason TEXT,
    decided_by VARCHAR(64) NOT NULL DEFAULT 'planner',
    execution_status VARCHAR(32) NOT NULL, -- pending, executed, failed, rejected_no_action
    execution_result_json JSONB,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_planner_decisions_rec ON planner_decisions(recommendation_id);

CREATE TABLE IF NOT EXISTS sim_system_events (
    id SERIAL PRIMARY KEY,
    system_name VARCHAR(32) NOT NULL,     -- POS, WMS, ERP
    event_type VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sim_events_sys ON sim_system_events(system_name, timestamp DESC);

CREATE TABLE IF NOT EXISTS scenario_runs (
    id SERIAL PRIMARY KEY,
    preset_name VARCHAR(64) NOT NULL,
    seed INT NOT NULL,
    horizon_days INT NOT NULL,
    policy_name VARCHAR(64) NOT NULL,
    metrics_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scenario_runs_preset ON scenario_runs(preset_name, seed);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id INT,
    actor VARCHAR(64) NOT NULL,
    details_json JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
