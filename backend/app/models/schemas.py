"""Pydantic schemas and data contracts for ZeroWaste AI."""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==========================================
# Core Domain Schemas
# ==========================================

class StoreSchema(BaseModel):
    id: int
    code: str
    name: str
    location: str
    square_meters: int
    created_at: Optional[datetime] = None


class ProductSchema(BaseModel):
    id: int
    sku: str
    name: str
    category: str
    unit_cost: float
    price: float
    shelf_life_days: int
    unit_weight_kg: float
    supplier_lead_time_days: int
    min_order_qty: int
    created_at: Optional[datetime] = None


class InventoryBatchSchema(BaseModel):
    id: int
    store_id: int
    product_id: int
    batch_code: str
    received_date: date
    expiry_date: date
    initial_quantity: int
    current_quantity: int
    unit_cost: float
    created_at: Optional[datetime] = None


class SalesHistorySchema(BaseModel):
    id: int
    store_id: int
    product_id: int
    sale_date: date
    units_sold: int
    unit_price: float
    promotions_active: bool = False


# ==========================================
# Forecasting & ML Schemas
# ==========================================

class CandidateForecastMetric(BaseModel):
    model_name: str  # seasonal_naive, moving_average_7d, simple_exponential_smoothing
    mae: float
    wape: float
    is_winner: bool = False


class ForecastResult(BaseModel):
    store_id: int
    product_id: int
    as_of_date: date
    horizon_days: int
    candidate_metrics: List[CandidateForecastMetric]
    winner_model: str
    is_tie: bool = False
    point_forecast: List[float]
    lower_bound: List[float]
    upper_bound: List[float]
    forecast_dates: List[date]


# ==========================================
# Spoilage Risk Schemas
# ==========================================

class SpoilageRiskResult(BaseModel):
    store_id: int
    product_id: int
    as_of_date: date
    on_hand_units: int
    at_risk_units: int
    risk_ratio: float
    risk_level: str  # Low, Medium, High
    at_risk_range_min: int
    at_risk_range_max: int
    reason: str
    batch_breakdown: List[Dict[str, Any]]


# ==========================================
# Action Scoring & Coordinator Schemas
# ==========================================

class ActionOptionScore(BaseModel):
    action: str  # no_action, markdown, donate, transfer, replenish
    is_feasible: bool
    expected_loss: float
    waste_avoided_kg: float
    cost_impact: float
    details: Dict[str, Any]


class RecommendationProposal(BaseModel):
    id: Optional[int] = None
    store_id: int
    store_name: Optional[str] = None
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    proposed_action: str
    proposed_quantity: int
    current_stock: int
    expiry_date: Optional[date] = None
    forecast_demand: float
    risk_level: str
    risk_ratio: float
    expected_loss: float
    waste_avoided_kg: float
    cost_impact: float
    alternatives: List[ActionOptionScore]
    explanation: str
    status: str = "pending"
    created_at: Optional[datetime] = None


# ==========================================
# Approval & Decision Schemas
# ==========================================

class ApproveProposalRequest(BaseModel):
    recommendation_id: int
    approved_quantity: Optional[int] = None  # safe quantity adjustment
    reason: Optional[str] = None
    decided_by: str = "planner"


class RejectProposalRequest(BaseModel):
    recommendation_id: int
    reason: str
    decided_by: str = "planner"


class BulkApproveRequest(BaseModel):
    recommendation_ids: List[int]
    decided_by: str = "planner"
    reason: Optional[str] = "Bulk approval for low-risk proposals"


class ExecutionResult(BaseModel):
    success: bool
    status: str  # executed, failed, rejected_no_action
    recommendation_id: int
    action: str
    quantity: int
    message: str
    stock_before: int
    stock_after: int
    events_logged: List[Dict[str, Any]]


# ==========================================
# Scenario Simulation Schemas
# ==========================================

class ScenarioPolicyMetrics(BaseModel):
    policy_name: str
    waste_units: float
    waste_cost: float
    stockout_units: float
    service_level_pct: float
    inventory_cost: float
    ordering_cost: float
    markdown_cost: float
    net_margin: float
    runtime_ms: float
    waste_reduction_pct: Optional[str] = None  # "n/a" or formatted string


class ScenarioRunResult(BaseModel):
    preset_name: str
    seeds_requested: int
    seeds_run: int
    seeds_capped: bool
    horizon_days: int
    policy_results: List[Dict[str, Any]]  # aggregated mean, min, max per policy


# ==========================================
# Audit & System Event Schemas
# ==========================================

class SimEventSchema(BaseModel):
    id: int
    system_name: str
    event_type: str
    payload: Dict[str, Any]
    timestamp: datetime


class AuditLogSchema(BaseModel):
    id: int
    action_type: str
    entity_type: str
    entity_id: Optional[int] = None
    actor: str
    details: Dict[str, Any]
    timestamp: datetime
