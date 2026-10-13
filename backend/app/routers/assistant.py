"""AI Assistant & Copilot router for ZeroWaste AI.

Adheres strictly to system rules:
- LLM/Assistant never does arithmetic or safety decisions.
- Every metric cited is computed directly from stored database state.
- Clearly labelled deterministic template engine with optional Gemini enhancement.
"""
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.auth import verify_api_key
from app.config import get_settings
from app.database import get_db_cursor

router = APIRouter(prefix="/api/assistant", tags=["AI Assistant"], dependencies=[Depends(verify_api_key)])


class ChatMessageRequest(BaseModel):
    message: str
    store_id: Optional[int] = None


class ChatMessageResponse(BaseModel):
    reply: str
    intent: str
    data_points: Dict[str, Any]
    suggested_actions: List[Dict[str, str]]
    source: str = "Deterministic Inventory Engine"


QUICK_PROMPTS = [
    {"label": "Expiring in 48h", "prompt": "What items are expiring in the next 48 hours?"},
    {"label": "Pending Proposals", "prompt": "Summarize pending coordinator recommendations"},
    {"label": "Carbon Savings", "prompt": "How much food waste and CO2e have we saved?"},
    {"label": "Store Imbalances", "prompt": "Which stores currently have inventory imbalances?"},
]


@router.get("/quick-prompts")
def get_quick_prompts():
    """Retrieve quick prompt suggestion chips."""
    return {"prompts": QUICK_PROMPTS}


@router.post("/chat", response_model=ChatMessageResponse)
def assistant_chat(req: ChatMessageRequest):
    """Answer inventory and operational queries grounded in computed database state."""
    settings = get_settings()
    as_of = date.fromisoformat(settings.AS_OF_DATE)
    msg_lower = req.message.lower().strip()

    with get_db_cursor() as cur:
        # 1. Intent: Carbon / Sustainability / Environment
        if any(w in msg_lower for w in ["carbon", "co2", "sustainab", "green", "saved", "divert", "kg saved", "emission"]):
            cur.execute(
                """
                SELECT COALESCE(SUM(waste_avoided_kg), 0)
                FROM recommendations
                WHERE status = 'executed';
                """
            )
            executed_kg = float(cur.fetchone()[0])
            co2e_kg = executed_kg * 2.5  # FAO benchmark

            reply = (
                f"🌱 **Sustainability Metrics To Date:**\n\n"
                f"• **Food Waste Diverted:** {executed_kg:.2f} kg\n"
                f"• **Greenhouse Gas Emissions Avoided:** {co2e_kg:.2f} kg CO2e\n"
                f"• **Emission Factor Used:** 2.50 kg CO2e per kg food waste (FAO standard benchmark)\n\n"
                f"Interventions like 20% markdowns and charity donations ensure that near-expiry items are consumed instead of decomposing in landfills."
            )

            return ChatMessageResponse(
                reply=reply,
                intent="sustainability_report",
                data_points={"waste_avoided_kg": executed_kg, "co2e_avoided_kg": co2e_kg},
                suggested_actions=[
                    {"label": "View Sustainability Panel", "href": "/"},
                    {"label": "View System Evaluation", "href": "/evaluation"},
                ],
            )

        # 2. Intent: Expiring in 48 hours / Near-expiry query
        elif any(w in msg_lower for w in ["expir", "shelf life", "spoil", "waste", "48h", "soon"]):
            cutoff = as_of + timedelta(days=2)
            cur.execute(
                """
                SELECT p.name, p.sku, s.name AS store_name, b.batch_code, b.expiry_date, b.current_quantity, p.price
                FROM inventory_batches b
                JOIN products p ON b.product_id = p.id
                JOIN stores s ON b.store_id = s.id
                WHERE b.current_quantity > 0 AND b.expiry_date <= %s
                ORDER BY b.expiry_date ASC, b.current_quantity DESC
                LIMIT 5;
                """,
                (cutoff,),
            )
            rows = cur.fetchall()

            cur.execute(
                """
                SELECT COALESCE(SUM(current_quantity), 0), COALESCE(SUM(current_quantity * unit_cost), 0)
                FROM inventory_batches
                WHERE current_quantity > 0 AND expiry_date <= %s;
                """,
                (cutoff,),
            )
            total_exp_units, total_exp_cost = cur.fetchone()

            if rows:
                item_lines = [
                    f"• {r[0]} ({r[1]}) at {r[2]}: {r[5]} units expiring on {r[4].isoformat() if hasattr(r[4], 'isoformat') else str(r[4])} (Batch {r[3]})"
                    for r in rows
                ]
                reply = (
                    f"There are currently **{int(total_exp_units)} units** ($ {float(total_exp_cost):.2f} cost basis) "
                    f"expiring within the next 48 hours across our retail network.\n\n"
                    f"**Most Critical Near-Expiry Batches:**\n" + "\n".join(item_lines) + "\n\n"
                    f"The coordinator recommends proactive markdowns or food bank donations to eliminate landfill disposal."
                )
            else:
                reply = "Good news! There are currently zero units expiring within the next 48 hours across our stores."

            return ChatMessageResponse(
                reply=reply,
                intent="expiring_inventory",
                data_points={"total_expiring_units": int(total_exp_units), "total_cost": float(total_exp_cost)},
                suggested_actions=[
                    {"label": "Review Planner Proposals", "href": "/planner"},
                    {"label": "Inspect Inventory Batches", "href": "/inventory"},
                ],
            )

        # 2. Intent: Recommendations / Proposals / Approvals
        elif any(w in msg_lower for w in ["recommend", "propos", "approv", "action", "planner", "what to do"]):
            cur.execute(
                """
                SELECT COUNT(*), 
                       COUNT(*) FILTER (WHERE risk_level = 'Low'),
                       COUNT(*) FILTER (WHERE risk_level = 'Medium'),
                       COUNT(*) FILTER (WHERE risk_level = 'High'),
                       COALESCE(SUM(waste_avoided_kg), 0),
                       COALESCE(SUM(expected_loss), 0)
                FROM recommendations
                WHERE status = 'pending';
                """
            )
            tot, low, med, high, waste_kg, loss = cur.fetchone()

            if int(tot) > 0:
                reply = (
                    f"The coordinator currently has **{int(tot)} pending proposals** awaiting human planner sign-off:\n\n"
                    f"• **High Risk:** {int(high)} proposals (immediate markdown or donation)\n"
                    f"• **Medium Risk:** {int(med)} proposals\n"
                    f"• **Low Risk:** {int(low)} proposals (eligible for 1-click bulk approval)\n\n"
                    f"Executing these approved interventions is projected to avoid **{float(waste_kg):.2f} kg** of food waste."
                )
            else:
                reply = (
                    "There are currently no pending proposals in the queue. "
                    "You can generate new proposals anytime by triggering the Agent Coordinator on the Planner page."
                )

            return ChatMessageResponse(
                reply=reply,
                intent="recommendations_summary",
                data_points={"pending_count": int(tot), "low_risk": int(low), "waste_avoided_kg": float(waste_kg)},
                suggested_actions=[
                    {"label": "Open Planner Center", "href": "/planner"},
                    {"label": "Run Simulation Presets", "href": "/scenarios"},
                ],
            )

        # 4. Intent: Store balances / Overstock / Shortage
        elif any(w in msg_lower for w in ["store", "imbalance", "overstock", "shortage", "transfer"]):
            cur.execute(
                """
                SELECT s.name, s.code, COALESCE(SUM(b.current_quantity), 0) AS total_units,
                       COUNT(b.id) AS batch_count
                FROM stores s
                LEFT JOIN inventory_batches b ON s.id = b.store_id AND b.current_quantity > 0
                GROUP BY s.id, s.name, s.code
                ORDER BY total_units DESC;
                """
            )
            store_rows = cur.fetchall()

            lines = [f"• **{r[0]}** ({r[1]}): {r[2]} units ({r[3]} active batches)" for r in store_rows]
            reply = (
                f"Here is the current inventory distribution across our retail network:\n\n"
                + "\n".join(lines) + "\n\n"
                f"The coordinator continuously checks for inter-store transfer opportunities where surplus stores can fulfill quantified deficits at neighboring branches."
            )

            return ChatMessageResponse(
                reply=reply,
                intent="store_distribution",
                data_points={"stores_counted": len(store_rows)},
                suggested_actions=[
                    {"label": "Explore Inventory", "href": "/inventory"},
                    {"label": "Check Audit Events", "href": "/audit"},
                ],
            )

        # 5. Default General Assistant
        else:
            cur.execute("SELECT COUNT(*) FROM products;")
            prod_cnt = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM stores;")
            store_cnt = cur.fetchone()[0]
            cur.execute("SELECT COALESCE(SUM(current_quantity), 0) FROM inventory_batches WHERE current_quantity > 0;")
            stock_cnt = cur.fetchone()[0]

            reply = (
                f"Hello! I am **ZeroWaste AI Assistant**, an agentic grocery inventory intelligence bot.\n\n"
                f"I actively monitor **{prod_cnt} perishable SKUs** across **{store_cnt} stores** "
                f"with a current on-hand position of **{int(stock_cnt)} units**.\n\n"
                f"You can ask me about:\n"
                f"• Near-expiry items and spoilage risks (e.g. *'What is expiring in 48 hours?'*)\n"
                f"• Pending coordinator proposals (e.g. *'Summarize recommendations'*)\n"
                f"• Carbon and food waste avoided (e.g. *'How much CO2e did we save?'*)\n"
                f"• Store inventory imbalances (e.g. *'Which store has surplus stock?'*)"
            )

            return ChatMessageResponse(
                reply=reply,
                intent="general_help",
                data_points={"product_count": prod_cnt, "store_count": store_cnt, "total_stock": int(stock_cnt)},
                suggested_actions=[
                    {"label": "Check Expiring Items", "href": "/inventory"},
                    {"label": "Review Planner", "href": "/planner"},
                ],
            )
