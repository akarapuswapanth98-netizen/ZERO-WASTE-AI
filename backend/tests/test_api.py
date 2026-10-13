"""Tests for API endpoints, responses, and data contracts."""
from fastapi.testclient import TestClient


def test_api_health_endpoint(client):
    """GET /api/health returns healthy status and system parameters."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database_connected"] is True


def test_api_inventory_endpoints(client):
    """GET /api/inventory and /api/inventory/batches return structured data."""
    res_inv = client.get("/api/inventory")
    assert res_inv.status_code == 200
    inv_data = res_inv.json()
    assert len(inv_data["stores"]) == 5
    assert len(inv_data["products"]) == 18
    assert inv_data["summary"]["total_units_on_hand"] > 0

    res_batches = client.get("/api/inventory/batches?store_id=1")
    assert res_batches.status_code == 200
    batch_data = res_batches.json()
    assert batch_data["count"] > 0
    assert "batch_code" in batch_data["batches"][0]


def test_api_forecast_endpoint(client):
    """GET /api/forecast returns 3 candidate models, winner, and confidence intervals."""
    res = client.get("/api/forecast?store_id=1&product_id=1&horizon_days=7")
    assert res.status_code == 200
    fc = res.json()
    assert fc["store_id"] == 1
    assert fc["product_id"] == 1
    assert len(fc["candidate_metrics"]) == 3
    assert len(fc["point_forecast"]) == 7
    assert len(fc["lower_bound"]) == 7
    assert len(fc["upper_bound"]) == 7


def test_api_spoilage_risk_with_time_travel(client):
    """GET /api/risk returns risk assessment with day_offset parameter."""
    res = client.get("/api/risk?store_id=1&product_id=1&day_offset=3")
    assert res.status_code == 200
    risk = res.json()
    assert risk["risk_level"] in ("Low", "Medium", "High")
    assert "reason" in risk
    assert risk["at_risk_range_min"] <= risk["at_risk_units"] <= risk["at_risk_range_max"]


def test_api_agents_run_and_trace(client):
    """POST /api/agents/run executes the 5 agents and logs trace."""
    res = client.post("/api/agents/run", json={"store_id": 1, "product_id": 1, "horizon_days": 7})
    assert res.status_code == 200
    proposal = res.json()
    assert proposal["proposed_action"] in ("no_action", "markdown_10", "markdown_20", "markdown_30", "markdown_50", "donate", "transfer", "replenish")
    assert len(proposal["alternatives"]) > 0

    res_trace = client.get("/api/agents/trace?limit=10")
    assert res_trace.status_code == 200
    assert res_trace.json()["count"] > 0


def test_api_counterfactual_replay(client):
    """POST /api/agents/replay performs counterfactual comparison."""
    res = client.post("/api/agents/replay", json={"store_id": 1, "product_id": 1, "hypothetical_stock": 5})
    assert res.status_code == 200
    data = res.json()
    assert "baseline" in data
    assert "counterfactual" in data
    assert "diff" in data


def test_api_scenarios_and_presets(client):
    """GET /api/scenarios/presets and POST /api/scenarios/run."""
    res_pre = client.get("/api/scenarios/presets")
    assert res_pre.status_code == 200
    assert len(res_pre.json()["presets"]) == 6

    res_run = client.post("/api/scenarios/run", json={"preset_name": "demand_spike", "seeds_count": 3, "horizon_days": 7})
    assert res_run.status_code == 200
    data = res_run.json()
    assert len(data["policy_results"]) == 3


def test_api_evaluation_and_csv_export(client):
    """GET /api/evaluation and /api/evaluation/export-csv."""
    res_eval = client.get("/api/evaluation")
    assert res_eval.status_code == 200
    assert "formulas" in res_eval.json()
    assert "benchmark_policies" in res_eval.json()

    res_csv = client.get("/api/evaluation/export-csv")
    assert res_csv.status_code == 200
    assert res_csv.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Policy Name" in res_csv.text
    assert "FIFO-only" in res_csv.text


def test_api_audit_logs_and_events(client):
    """GET /api/audit/logs and /api/audit/events."""
    res_logs = client.get("/api/audit/logs")
    assert res_logs.status_code == 200
    assert "logs" in res_logs.json()

    res_events = client.get("/api/audit/events")
    assert res_events.status_code == 200
    assert "events" in res_events.json()


def test_api_admin_reseed(admin_client):
    """POST /api/admin/reseed with admin token."""
    res = admin_client.post("/api/admin/reseed?seed=42")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
