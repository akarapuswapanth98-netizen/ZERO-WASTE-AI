import type { AuditData, Batch, EvaluationData, ForecastData, Rec, RecDetail, RiskData, ScenarioOut, Store, Product } from "./types";

// Same-origin: all browser traffic goes through Next.js route handlers
// (app/api/[...slug]), which attach the server-only API key. The key never
// appears here or in the client bundle.
const BASE = "";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${txt.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface InventoryOut { inventory: Batch[]; count: number; }
export interface RecsOut { recommendations: Rec[]; }
export interface StoresOut { stores: Store[]; }
export interface ProductsOut { products: Product[]; simulated: boolean; }
export interface RunAgentsOut { count: number; results: Array<{ rec_id: string; store_id: string; sku: string; action: string; quantity: number }>; }
export interface ReplayOut { replayed: number; diffs: Array<{ store_id: string; sku: string; before: string; after: string }>; diff_count: number; }
export interface DecideOut { ok: boolean; rec_id: string; decision: string; quantity: number; }
export interface ExecuteOut { ok: boolean; status: string; simulated?: boolean; message?: string; reason?: string; }

export interface CalibrationOut {
  asof: string; horizon_days: number; note: string;
  cover: Array<{ sku: string; store_id: string; cover_days: number; shelf_life_days: number; on_hand: number }>;
  fifo_single_seed: Record<string, { waste_units: number; stockout_units: number; service_level: number }>;
  presets: Record<string, Record<string, unknown>>;
}

export const api = {
  health: () => req<{ status: string; demo_mode: boolean; synthetic: boolean; seed: number; asof: string }>("/api/health"),
  reset: (seed = 42) => req<{ seed: number; counts: Record<string, number>; asof: string }>(`/api/seed/reset?seed=${seed}`, { method: "POST" }),
  stores: () => req<StoresOut>("/api/stores"),
  products: (category?: string) => req<ProductsOut>(`/api/products${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  inventory: (p: Record<string, string> = {}) => {
    const q = new URLSearchParams(p).toString();
    return req<InventoryOut>(`/api/inventory${q ? `?${q}` : ""}`);
  },
  forecast: (store_id: string, sku: string, horizon = 7) =>
    req<ForecastData>(`/api/forecast?store_id=${store_id}&sku=${sku}&horizon=${horizon}`),
  risk: (store_id: string, sku: string, low = 0.1, high = 0.3, dayOffset = 0) =>
    req<RiskData>(`/api/risk?store_id=${store_id}&sku=${sku}&low_thr=${low}&high_thr=${high}&day_offset=${dayOffset}`),
  runAgents: (body: Record<string, unknown>) => req<RunAgentsOut>("/api/agents/run", { method: "POST", body: JSON.stringify(body) }),
  replay: (body: Record<string, unknown>) => req<ReplayOut>("/api/agents/replay", { method: "POST", body: JSON.stringify(body) }),
  recs: (p: Record<string, string> = {}) => {
    const q = new URLSearchParams(p).toString();
    return req<RecsOut>(`/api/recommendations${q ? `?${q}` : ""}`);
  },
  recDetail: (id: string) => req<RecDetail>(`/api/recommendations/${id}`),
  runDetail: (id: string) => req<{ inputs: unknown; outputs: unknown }>(`/api/agents/runs/${id}`),
  approve: (id: string, body: Record<string, unknown>) => req<DecideOut>(`/api/planner/approve/${id}`, { method: "POST", body: JSON.stringify(body) }),
  reject: (id: string, body: Record<string, unknown>) => req<DecideOut>(`/api/planner/reject/${id}`, { method: "POST", body: JSON.stringify(body) }),
  bulk: (body: Record<string, unknown>) => req<{ bulk_approved: number }>("/api/planner/bulk-approve", { method: "POST", body: JSON.stringify(body) }),
  execute: (id: string) => req<ExecuteOut>(`/api/execute/${id}`, { method: "POST" }),
  scenario: (body: Record<string, unknown>) => req<ScenarioOut>("/api/scenarios/run", { method: "POST", body: JSON.stringify(body) }),
  calibration: () => req<CalibrationOut>("/api/scenarios/calibration"),
  evaluation: () => req<EvaluationData>("/api/evaluation"),
  audit: () => req<AuditData>("/api/audit"),
};
export const API_BASE = BASE;
