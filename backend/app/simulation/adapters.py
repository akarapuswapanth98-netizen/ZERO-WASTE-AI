"""Simulated POS, WMS, and ERP adapters with event logging into sim_system_events."""
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from app.database import get_db_cursor


def log_simulated_system_event(
    system_name: str,
    event_type: str,
    payload: Dict[str, Any],
    database_url: Optional[str] = None,
) -> None:
    """Record an audit trail event for simulated POS, WMS, or ERP integration."""
    payload_copy = dict(payload)
    payload_copy["simulation_note"] = "Simulated Integration / Synthetic Event"
    now = datetime.now(timezone.utc)

    try:
        with get_db_cursor(database_url) as cur:
            cur.execute(
                """
                INSERT INTO sim_system_events (system_name, event_type, payload_json, timestamp)
                VALUES (%s, %s, %s, %s);
                """,
                (system_name, event_type, json.dumps(payload_copy, default=str), now),
            )
    except Exception:
        pass


class SimulatedPOSAdapter:
    """Simulated Point of Sale adapter."""

    @staticmethod
    def sync_sales_transaction(store_id: int, product_id: int, units_sold: int, sale_price: float, database_url: Optional[str] = None) -> None:
        log_simulated_system_event(
            system_name="POS",
            event_type="SALES_TRANSACTION_INGESTED",
            payload={"store_id": store_id, "product_id": product_id, "units_sold": units_sold, "sale_price": sale_price},
            database_url=database_url,
        )

    @staticmethod
    def update_shelf_price_markdown(store_id: int, product_id: int, original_price: float, markdown_price: float, database_url: Optional[str] = None) -> None:
        log_simulated_system_event(
            system_name="POS",
            event_type="ELECTRONIC_SHELF_LABEL_UPDATED",
            payload={"store_id": store_id, "product_id": product_id, "original_price": original_price, "markdown_price": markdown_price},
            database_url=database_url,
        )


class SimulatedWMSAdapter:
    """Simulated Warehouse Management System adapter."""

    @staticmethod
    def issue_pick_order_for_donation(store_id: int, product_id: int, batch_code: str, quantity: int, database_url: Optional[str] = None) -> None:
        log_simulated_system_event(
            system_name="WMS",
            event_type="DONATION_PICK_ORDER_ISSUED",
            payload={"store_id": store_id, "product_id": product_id, "batch_code": batch_code, "quantity": quantity},
            database_url=database_url,
        )

    @staticmethod
    def initiate_inter_store_transfer(from_store_id: int, to_store_id: int, product_id: int, quantity: int, database_url: Optional[str] = None) -> None:
        log_simulated_system_event(
            system_name="WMS",
            event_type="TRANSFER_MANIFEST_GENERATED",
            payload={"from_store_id": from_store_id, "to_store_id": to_store_id, "product_id": product_id, "quantity": quantity},
            database_url=database_url,
        )


class SimulatedERPAdapter:
    """Simulated Enterprise Resource Planning adapter."""

    @staticmethod
    def submit_replenishment_purchase_order(store_id: int, product_id: int, quantity: int, unit_cost: float, database_url: Optional[str] = None) -> None:
        log_simulated_system_event(
            system_name="ERP",
            event_type="PURCHASE_ORDER_SUBMITTED",
            payload={"store_id": store_id, "product_id": product_id, "quantity": quantity, "unit_cost": unit_cost, "po_number": f"PO-SIM-{datetime.now().strftime('%Y%m%d%H%M%S')}"},
            database_url=database_url,
        )

    @staticmethod
    def log_spoilage_writeoff(store_id: int, product_id: int, quantity: int, writeoff_cost: float, database_url: Optional[str] = None) -> None:
        log_simulated_system_event(
            system_name="ERP",
            event_type="INVENTORY_WRITEOFF_RECORDED",
            payload={"store_id": store_id, "product_id": product_id, "quantity": quantity, "writeoff_cost": writeoff_cost},
            database_url=database_url,
        )
