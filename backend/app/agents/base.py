"""Base agent interface with structured I/O, validation, and audit tracking."""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
import json
import time
from typing import Any, Dict, Optional
from pydantic import BaseModel
from app.database import get_db_cursor


class AgentExecutionLog(BaseModel):
    agent_name: str
    store_id: Optional[int]
    product_id: Optional[int]
    inputs: Dict[str, Any]
    outputs: Dict[str, Any]
    execution_time_ms: float
    validation_passed: bool
    error_message: Optional[str] = None
    run_timestamp: datetime


class BaseAgent(ABC):
    """Abstract base class for ZeroWaste AI agents."""

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent logic."""
        pass

    def execute_and_log(
        self,
        inputs: Dict[str, Any],
        store_id: Optional[int] = None,
        product_id: Optional[int] = None,
        persist_run: bool = True,
        database_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute agent with timing, structured validation, and audit persistence."""
        start_time = time.perf_counter()
        validation_passed = True
        error_msg = None
        outputs = {}

        try:
            outputs = self.run(inputs)
        except Exception as exc:
            validation_passed = False
            error_msg = str(exc)
            outputs = {"error": error_msg}
            raise exc
        finally:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            now = datetime.now(timezone.utc)

            if persist_run:
                try:
                    with get_db_cursor(database_url) as cur:
                        cur.execute(
                            """
                            INSERT INTO agent_runs (
                                run_timestamp, store_id, product_id, agent_name,
                                inputs_json, outputs_json, execution_time_ms,
                                validation_passed, error_message
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                            """,
                            (
                                now,
                                store_id,
                                product_id,
                                self.name,
                                json.dumps(inputs, default=str),
                                json.dumps(outputs, default=str),
                                elapsed_ms,
                                validation_passed,
                                error_msg,
                            ),
                        )
                except Exception:
                    # In test environments or transaction rollbacks, do not obscure primary output
                    pass

        return outputs
