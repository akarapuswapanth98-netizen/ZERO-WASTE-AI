export type Status = "loading" | "ready" | "error" | "empty";
export type RiskBand = "Low" | "Medium" | "High";
export type RecStatus = "proposed" | "approved" | "rejected" | "executed" | "failed" | "superseded";
export type ActionType = "no-action" | "markdown" | "donate" | "transfer" | "replenish";

export interface Store { store_id: string; name: string; location: string; }
export interface Product {
  sku: string; name: string; category: string; unit_cost: number; unit_price: number;
  shelf_life_days: number; unit_weight_kg: number; lead_time_days: number; moq: number;
}
export interface Batch {
  batch_id: string; store_id: string; sku: string; qty_initial: number; qty_on_hand: number;
  received_date: string; expiry_date: string; unit_cost: number;
  name?: string; category?: string; unit_price?: number; unit_weight_kg?: number; shelf_life_days?: number;
}
export interface ForecastData {
  history_dates: string[]; history_values: number[]; train_len: number; test_len: number;
  test_values: number[]; test_models: { ses: number[]; ma: number[]; seasonal: number[] };
  forecast_mean: number[]; forecast_low: number[]; forecast_high: number[];
  baseline_forecast: number[]; seasonal_forecast: number[];
  model: { name: string; alpha: number; mae: number; wape: number };
  baseline: { name: string; mae: number; wape: number };
  seasonal: { name: string; mae: number; wape: number };
  winner: string;
  engine?: string;
  residual_std: number; interval_z: number; interval_label: string;
  beats_baseline: boolean; honesty_note: string; duration_ms: number;
}
export interface RiskData {
  on_hand: number; at_risk_mean: number; at_risk_low_demand: number; at_risk_high_demand: number;
  risk_ratio: number; risk_range: [number, number]; band: RiskBand; reason: string;
  days_to_first_expiry: number; thresholds: { low: number; high: number };
  forecast_7d: number;
  disclaimer?: string; day_offset?: number; effective_date?: string;
}
export interface OptionScore {
  action: ActionType | string; quantity: number; expected_loss: number | null;
  detail?: string; discount?: number; to_store?: string; feasible?: boolean; reason?: string;
}
export interface Rec {
  rec_id: string; run_id?: string; store_id: string; sku: string; action_type: ActionType | string;
  quantity: number; expected_loss: number; expected_waste_avoided?: number; confidence?: number;
  explanation: string; status: RecStatus; created_at: string;
  product_name?: string; category?: string; unit_price?: number;
}
export interface RecDetail extends Rec {
  params: OptionScore; alternatives: OptionScore[];
}
export interface AgentRun { run_id: string; created_at: string; agent_name: string; store_id: string | null; sku: string | null; status: string; duration_ms: number; }
export interface AuditRow { [k: string]: unknown; created_at?: string; }
export interface ScenarioRow { scenario_id: string; scenario_name: string; seed: number; policy: string; params: Record<string, unknown>; metrics: Record<string, { mean: number; min: number; max: number }>; created_at: string; }
export type Policy = "agentic" | "fifo" | "fixed-threshold";
export interface MetricStat { mean: number; min: number; max: number; }
export interface ScenarioOut {
  preset: string; params: Record<string, unknown>;
  policies: Record<Policy, Record<string, MetricStat>>;
  waste_reduction_pct: number | null; waste_reduction_note: string;
  seeds_run?: number; seeds_capped?: boolean;
}
export interface EvaluationData {
  scenario_runs: ScenarioRow[]; decisions: Array<{ decision: string; n: number }>;
  recommendation_status: Array<{ status: string; n: number }>;
  latest_comparison: {
    preset: string; seed: number; seeds: number;
    policies: Record<string, Record<string, { mean: number; min: number; max: number }>>;
    waste_reduction_pct: number | null; waste_reduction_note: string; trade_off_note: string;
  } | null;
  methodology: string; assumptions: string;
}
export interface AuditData {
  audit_logs: AuditRow[];
  system_events: AuditRow[];
  agent_runs: AgentRun[];
  agent_counts: Array<{ agent_name: string; n: number }>;
}
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
