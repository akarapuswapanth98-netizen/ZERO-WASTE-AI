"""Tests for AI Assistant endpoints and grounded database queries."""
from fastapi.testclient import TestClient


def test_assistant_quick_prompts(client: TestClient):
    """GET /api/assistant/quick-prompts returns quick prompt chips."""
    res = client.get("/api/assistant/quick-prompts")
    assert res.status_code == 200
    data = res.json()
    assert "prompts" in data
    assert len(data["prompts"]) >= 4
    assert any("Expiring" in p["label"] for p in data["prompts"])


def test_assistant_chat_expiring_query(client: TestClient):
    """POST /api/assistant/chat with expiring/shelf-life query."""
    res = client.post(
        "/api/assistant/chat",
        json={"message": "What items are expiring in the next 48 hours?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "expiring_inventory"
    assert "total_expiring_units" in data["data_points"]
    assert "suggested_actions" in data
    assert len(data["suggested_actions"]) > 0
    assert "units" in data["reply"] or "zero units" in data["reply"]


def test_assistant_chat_recommendations_query(client: TestClient):
    """POST /api/assistant/chat with pending recommendations query."""
    res = client.post(
        "/api/assistant/chat",
        json={"message": "Summarize pending coordinator proposals"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "recommendations_summary"
    assert "pending_count" in data["data_points"]
    assert len(data["suggested_actions"]) > 0


def test_assistant_chat_sustainability_query(client: TestClient):
    """POST /api/assistant/chat with carbon and food waste query."""
    res = client.post(
        "/api/assistant/chat",
        json={"message": "How much carbon and food waste have we saved?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "sustainability_report"
    assert "waste_avoided_kg" in data["data_points"]
    assert "co2e_avoided_kg" in data["data_points"]
    assert "2.50" in data["reply"]  # FAO standard factor


def test_assistant_chat_store_distribution_query(client: TestClient):
    """POST /api/assistant/chat with store inventory imbalance query."""
    res = client.post(
        "/api/assistant/chat",
        json={"message": "Which stores have surplus or imbalance?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "store_distribution"
    assert data["data_points"]["stores_counted"] >= 5


def test_assistant_chat_general_query(client: TestClient):
    """POST /api/assistant/chat with general greeting or question."""
    res = client.post(
        "/api/assistant/chat",
        json={"message": "Hello, how can you help me?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "general_help"
    assert "ZeroWaste AI Assistant" in data["reply"]
    assert "product_count" in data["data_points"]
