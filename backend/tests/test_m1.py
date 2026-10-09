"""M1 gate tests: workflow, approve/reject, reproducibility, constraints."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DEMO_MODE","true")
os.environ.setdefault("AS_OF","2026-10-05")
from fastapi.testclient import TestClient
from app.main import app
from app import database as db

client = TestClient(app)

def test_api_key_enforced_when_demo_off():
    from app import config
    old = config.DEMO_MODE
    config.DEMO_MODE = False
    try:
        assert client.get("/api/stores").status_code == 401
        ok = client.get("/api/stores", headers={"X-API-Key": config.API_KEY})
        assert ok.status_code == 200
    finally:
        config.DEMO_MODE = old

def test_workflow():
    assert client.post("/api/seed/reset", params={"seed":42}).status_code==200
    r=client.post("/api/agents/run", json={"store_id":"store_001","sku":"MILK-1L"})
    assert r.status_code==200 and r.json()["count"]>=1
    rec_id=r.json()["results"][0]["rec_id"]
    d=client.get(f"/api/recommendations/{rec_id}")
    assert d.status_code==200 and "alternatives" in d.json()
    # approve -> execute
    assert client.post(f"/api/planner/approve/{rec_id}", json={"reason":"test"}).status_code==200
    ex=client.post(f"/api/execute/{rec_id}")
    assert ex.json()["status"] in ("executed","failed")

def test_reject_executes_nothing():
    client.post("/api/seed/reset", params={"seed":42})
    r=client.post("/api/agents/run", json={"store_id":"store_002","sku":"BREAD-WH"}).json()
    rec_id=r["results"][0]["rec_id"]
    assert client.post(f"/api/planner/reject/{rec_id}", json={"reason":"test reject"}).status_code==200
    ex=client.post(f"/api/execute/{rec_id}")
    assert ex.status_code==400  # rejected never execute

def test_scenario_reproducible():
    client.post("/api/seed/reset", params={"seed":42})
    a=client.post("/api/scenarios/run", json={"preset":"demand_spike","seeds":5,"base_seed":7}).json()
    b=client.post("/api/scenarios/run", json={"preset":"demand_spike","seeds":5,"base_seed":7}).json()
    for pol in ("agentic","fifo","fixed-threshold"):
        for k in ("waste_units","waste_cost","stockout_units","order_cost","revenue","sales_units","service_level"):
            assert a["policies"][pol][k]==b["policies"][pol][k], f"{pol}/{k} not reproducible"

def test_constraints():
    from app.coordinator import run_coordinator
    client.post("/api/seed/reset", params={"seed":42})
    out=run_coordinator("store_001","BREAD-WH")
    assert out["primary"]["action"] in ("no-action","markdown","donate","transfer","replenish")
    # exactly one primary
    assert "rec_id" in out
