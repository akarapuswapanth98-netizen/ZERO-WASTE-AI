/** Typed client talking exclusively to the Next.js /api proxy */

export interface Store {
  id: number;
  code: string;
  name: string;
  location: string;
  square_meters: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit_cost: number;
  price: number;
  shelf_life_days: number;
  unit_weight_kg: number;
  supplier_lead_time_days: number;
  min_order_qty: number;
  total_on_hand: number;
}

export interface InventoryBatch {
  id: number;
  store_id: number;
  store_name: string;
  product_id: number;
  product_name: string;
  sku: string;
  category: string;
  batch_code: string;
  received_date: string;
  expiry_date: string;
  initial_quantity: number;
  current_quantity: number;
  unit_cost: number;
}

export interface ActionAlternative {
  action: string;
  is_feasible: boolean;
  expected_loss: number;
  waste_avoided_kg: number;
  cost_impact: number;
  details: Record<string, any>;
}

export interface Recommendation {
  id: number;
  store_id: number;
  store_name?: string;
  product_id: number;
  product_name?: string;
  sku?: string;
  category?: string;
  proposed_action: string;
  proposed_quantity: number;
  current_stock: number;
  expiry_date?: string;
  forecast_demand: number;
  risk_level: "Low" | "Medium" | "High";
  risk_ratio: number;
  expected_loss: number;
  waste_avoided_kg: number;
  cost_impact: number;
  alternatives: ActionAlternative[];
  explanation: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  created_at?: string;
}

export interface CandidateMetric {
  model_name: string;
  mae: number;
  wape: number;
  is_winner: boolean;
}

export interface ForecastResponse {
  store_id: number;
  product_id: number;
  as_of_date: string;
  horizon_days: number;
  candidate_metrics: CandidateMetric[];
  winner_model: string;
  is_tie: boolean;
  point_forecast: number[];
  lower_bound: number[];
  upper_bound: number[];
  forecast_dates: string[];
}

export interface SpoilageRiskResponse {
  store_id: number;
  product_id: number;
  as_of_date: string;
  on_hand_units: number;
  at_risk_units: number;
  risk_ratio: number;
  risk_level: "Low" | "Medium" | "High";
  at_risk_range_min: number;
  at_risk_range_max: number;
  reason: string;
  batch_breakdown: any[];
}

export interface ScenarioPolicyResult {
  policy_name: string;
  waste_units_mean: number;
  waste_units_min: number;
  waste_units_max: number;
  waste_cost_mean: number;
  waste_cost_min: number;
  waste_cost_max: number;
  stockout_units_mean: number;
  stockout_units_min: number;
  stockout_units_max: number;
  service_level_pct_mean: number;
  service_level_pct_min: number;
  service_level_pct_max: number;
  net_margin_mean: number;
  net_margin_min: number;
  net_margin_max: number;
  runtime_ms_mean: number;
  waste_reduction_pct: string;
}

export interface ScenarioResponse {
  preset_name: string;
  seeds_requested: number;
  seeds_run: number;
  seeds_capped: boolean;
  horizon_days: number;
  policy_results: ScenarioPolicyResult[];
}

export interface AuditLog {
  id: number;
  action_type: string;
  entity_type: string;
  entity_id?: number;
  actor: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface SimEvent {
  id: number;
  system_name: string;
  event_type: string;
  payload: Record<string, any>;
  timestamp: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errMessage = `API error ${res.status}`;
    try {
      const errData = await res.json();
      errMessage = errData.detail || errData.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  return res.json();
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; database_connected: boolean; as_of_date: string }>("/health"),

  // Inventory
  getInventory: () =>
    request<{
      stores: Store[];
      products: Product[];
      summary: { active_batches_count: number; total_units_on_hand: number; total_inventory_value: number };
    }>("/inventory"),

  getBatches: (storeId?: number, productId?: number, category?: string) => {
    const params = new URLSearchParams();
    if (storeId) params.append("store_id", storeId.toString());
    if (productId) params.append("product_id", productId.toString());
    if (category) params.append("category", category);
    return request<{ count: number; batches: InventoryBatch[] }>(`/inventory/batches?${params.toString()}`);
  },

  // Forecast
  getForecast: (storeId: number, productId: number, horizon = 7) =>
    request<ForecastResponse>(`/forecast?store_id=${storeId}&product_id=${productId}&horizon_days=${horizon}`),

  // Risk
  getRisk: (storeId: number, productId: number, dayOffset = 0, low = 0.1, med = 0.3) =>
    request<SpoilageRiskResponse>(
      `/risk?store_id=${storeId}&product_id=${productId}&day_offset=${dayOffset}&low_threshold=${low}&med_threshold=${med}`
    ),

  getAllRisks: (storeId?: number, dayOffset = 0) => {
    const params = new URLSearchParams();
    if (storeId) params.append("store_id", storeId.toString());
    params.append("day_offset", dayOffset.toString());
    return request<{ as_of_date: string; day_offset: number; count: number; risks: SpoilageRiskResponse[] }>(
      `/risk/all?${params.toString()}`
    );
  },

  // Agents
  runAgents: (storeId: number, productId: number, horizon = 7) =>
    request<Recommendation>("/agents/run", {
      method: "POST",
      body: JSON.stringify({ store_id: storeId, product_id: productId, horizon_days: horizon }),
    }),

  runAllAgents: () =>
    request<{ count: number; proposals: Recommendation[] }>("/agents/run-all", {
      method: "POST",
    }),

  getAgentTraces: (limit = 30) => request<{ count: number; traces: any[] }>(`/agents/trace?limit=${limit}`),

  replayCounterfactual: (storeId: number, productId: number, overrides: { hypothetical_stock?: number; hypothetical_lead_time?: number }) =>
    request<{ baseline: Recommendation; counterfactual: Recommendation; diff: any }>("/agents/replay", {
      method: "POST",
      body: JSON.stringify({ store_id: storeId, product_id: productId, ...overrides }),
    }),

  // Recommendations
  getRecommendations: (storeId?: number, status?: string, riskLevel?: string) => {
    const params = new URLSearchParams();
    if (storeId) params.append("store_id", storeId.toString());
    if (status) params.append("status", status);
    if (riskLevel) params.append("risk_level", riskLevel);
    return request<{ count: number; recommendations: Recommendation[] }>(`/recommendations?${params.toString()}`);
  },

  approveProposal: (recommendationId: number, approvedQuantity?: number, reason?: string) =>
    request<any>("/recommendations/approve", {
      method: "POST",
      body: JSON.stringify({
        recommendation_id: recommendationId,
        approved_quantity: approvedQuantity,
        reason: reason,
      }),
    }),

  rejectProposal: (recommendationId: number, reason: string) =>
    request<any>("/recommendations/reject", {
      method: "POST",
      body: JSON.stringify({
        recommendation_id: recommendationId,
        reason: reason,
      }),
    }),

  bulkApproveLowRisk: (recommendationIds: number[], reason?: string) =>
    request<any[]>("/recommendations/bulk-approve", {
      method: "POST",
      body: JSON.stringify({
        recommendation_ids: recommendationIds,
        reason: reason,
      }),
    }),

  // Scenarios
  getPresets: () => request<{ presets: any[] }>("/scenarios/presets"),

  runScenario: (presetName: string, seedsCount = 5, horizonDays = 14) =>
    request<ScenarioResponse>("/scenarios/run", {
      method: "POST",
      body: JSON.stringify({
        preset_name: presetName,
        seeds_count: seedsCount,
        horizon_days: horizonDays,
      }),
    }),

  // Evaluation
  getEvaluation: () =>
    request<{
      evaluation_period_days: number;
      sample_size_seeds: number;
      formulas: Record<string, string>;
      modelling_assumptions: string[];
      benchmark_policies: ScenarioPolicyResult[];
    }>("/evaluation"),

  // Audit
  getAuditLogs: (limit = 50, actionType?: string) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (actionType) params.append("action_type", actionType);
    return request<{ count: number; logs: AuditLog[] }>(`/audit/logs?${params.toString()}`);
  },

  getSimEvents: (limit = 50, systemName?: string) => {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (systemName) params.append("system_name", systemName);
    return request<{ count: number; events: SimEvent[] }>(`/audit/events?${params.toString()}`);
  },

  // AI Assistant Copilot
  getAssistantPrompts: () => request<{ prompts: AssistantPrompt[] }>("/assistant/quick-prompts"),
  sendAssistantMessage: (message: string, storeId?: number) =>
    request<AssistantResponse>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message, store_id: storeId }),
    }),
};

export interface AssistantPrompt {
  label: string;
  prompt: string;
}

export interface AssistantResponse {
  reply: string;
  intent: string;
  data_points: Record<string, any>;
  suggested_actions: { label: string; href: string }[];
  source: string;
}
