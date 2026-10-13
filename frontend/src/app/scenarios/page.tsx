"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { api, ScenarioPolicyResult, ScenarioResponse } from "@/lib/api";

const PRESET_DESCRIPTIONS: Record<string, string> = {
  demand_spike: "+40% demand surge across consecutive days.",
  supplier_delay: "+4 days supplier lead time delay.",
  shorter_shelf_life: "-30% batch shelf life on receipt.",
  promotional_markdown: "Competitor promotion drops baseline sales by 25%.",
  excess_inventory: "+50% initial batch overstock.",
  store_variance: "High demand volatility across stores (+50% variance).",
};

export default function ScenariosPage() {
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("demand_spike");
  const [seedsCount, setSeedsCount] = useState<number>(5);
  const [horizonDays, setHorizonDays] = useState<number>(14);

  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPresets()
      .then((data) => setPresets(data.presets || []))
      .catch((err) => console.error("Failed to load presets:", err));

    // Run default scenario initial load
    handleRunScenario("demand_spike", 5, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunScenario = async (preset = selectedPreset, seeds = seedsCount, horizon = horizonDays) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.runScenario(preset, seeds, horizon);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to execute scenario simulation");
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data for comparative metrics
  const chartData = result?.policy_results.map((p) => ({
    name: p.policy_name,
    wasteUnits: p.waste_units_mean,
    wasteCost: p.waste_cost_mean,
    stockouts: p.stockout_units_mean,
    serviceLevel: p.service_level_pct_mean,
    margin: p.net_margin_mean,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">Scenario Simulator</h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Head-to-head policy benchmark: FIFO-only vs Fixed-threshold vs Agentic Replanning.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-[#172A20] px-3 py-1.5 rounded-lg border border-[#2A4033] text-[#9EB5A8]">
          <span>Seeds Run: <strong className="text-[#66E3A1]">{result?.seeds_run || seedsCount}</strong></span>
          {result?.seeds_capped && <span className="text-[#F4B860]">(Capped for serverless)</span>}
        </div>
      </div>

      {/* Preset Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.keys(PRESET_DESCRIPTIONS).map((key) => {
          const isSelected = selectedPreset === key;
          return (
            <button
              key={key}
              id={`preset-${key}`}
              onClick={() => {
                setSelectedPreset(key);
                handleRunScenario(key, seedsCount, horizonDays);
              }}
              className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col justify-between ${
                isSelected
                  ? "bg-[#1C3A2A] border-[#66E3A1] shadow-glow"
                  : "bg-[#172A20]/60 border-[#2A4033] hover:border-[#66E3A1]/40"
              }`}
            >
              <span className="font-bold text-[#E8F2EC] capitalize block">
                {key.replace("_", " ")}
              </span>
              <span className="text-[10px] text-[#9EB5A8] mt-1 line-clamp-2">
                {PRESET_DESCRIPTIONS[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Simulation Controls Bar */}
      <GlassPanel className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <label className="text-[#9EB5A8] block mb-1">Monte Carlo Seeds:</label>
            <select
              value={seedsCount}
              onChange={(e) => setSeedsCount(parseInt(e.target.value, 10))}
              className="bg-[#101D16] border border-[#2A4033] rounded-lg px-3 py-1.5 text-xs text-[#E8F2EC]"
            >
              <option value={3}>3 Seeds (Fastest)</option>
              <option value={5}>5 Seeds (Balanced)</option>
              <option value={10}>10 Seeds (Detailed)</option>
              <option value={20}>20 Seeds (Local Max)</option>
            </select>
          </div>

          <div>
            <label className="text-[#9EB5A8] block mb-1">Horizon Horizon:</label>
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(parseInt(e.target.value, 10))}
              className="bg-[#101D16] border border-[#2A4033] rounded-lg px-3 py-1.5 text-xs text-[#E8F2EC]"
            >
              <option value={7}>7 Days (1 Week)</option>
              <option value={14}>14 Days (2 Weeks)</option>
              <option value={21}>21 Days (3 Weeks)</option>
            </select>
          </div>
        </div>

        <GlassButton
          variant="primary"
          size="md"
          onClick={() => handleRunScenario()}
          loading={loading}
          id="btn-run-simulation"
        >
          <Play className="w-4 h-4 mr-1.5 fill-current" />
          Run Simulation
        </GlassButton>
      </GlassPanel>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FF7D78]/15 border border-[#FF7D78]/30 text-[#FF7D78] text-xs">
          {error}
        </div>
      )}

      {/* Comparative Metrics Table */}
      <GlassPanel className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[#2A4033] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#E8F2EC]">Policy Performance Matrix</h2>
            <p className="text-xs text-[#9EB5A8]">
              Mean values shown with min–max error spreads across all {result?.seeds_run || seedsCount} reproducible seeds.
            </p>
          </div>
          <span className="text-[11px] text-[#66E3A1] bg-[#1C3A2A] px-2.5 py-1 rounded-full border border-[#66E3A1]/30 font-semibold">
            Strict No-Look-Ahead Replanning
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="table-scenario-results">
            <thead className="bg-[#101D16]/90 border-b border-[#2A4033] text-[11px] font-semibold text-[#9EB5A8] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Policy Name</th>
                <th className="px-4 py-3 text-right">Waste Units (Min–Max)</th>
                <th className="px-4 py-3 text-right">Waste Cost ($)</th>
                <th className="px-4 py-3 text-right">Stockout Units</th>
                <th className="px-4 py-3 text-right">Service Level %</th>
                <th className="px-4 py-3 text-right">Net Margin ($)</th>
                <th className="px-4 py-3 text-right">Waste Reduction</th>
                <th className="px-4 py-3 text-right">Runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A4033]/60">
              {result?.policy_results.map((p) => {
                const isAgentic = p.policy_name === "Agentic";
                return (
                  <tr
                    key={p.policy_name}
                    className={`hover:bg-[#1C3A2A]/40 transition-colors ${
                      isAgentic ? "bg-[#66E3A1]/5 font-medium" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 flex items-center gap-2">
                      <span className="font-bold text-[#E8F2EC] text-sm">{p.policy_name}</span>
                      {isAgentic && (
                        <span className="text-[10px] bg-[#66E3A1] text-[#0B1511] font-bold px-1.5 py-0.5 rounded">
                          AI
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-[#E8F2EC]">{p.waste_units_mean}</span>
                      <span className="text-[10px] text-[#9EB5A8] ml-1">
                        ({p.waste_units_min}–{p.waste_units_max})
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-[#E8F2EC]">
                      ${p.waste_cost_mean.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#FF7D78]">
                      {p.stockout_units_mean} units
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#66E3A1]">
                      {p.service_level_pct_mean.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#E8F2EC]">
                      ${p.net_margin_mean.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full ${
                          p.waste_reduction_pct === "n/a"
                            ? "text-[#9EB5A8] bg-[#172A20]"
                            : parseFloat(p.waste_reduction_pct) > 0
                            ? "text-[#66E3A1] bg-[#66E3A1]/15"
                            : "text-[#FF7D78] bg-[#FF7D78]/15"
                        }`}
                      >
                        {p.waste_reduction_pct}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#9EB5A8] font-mono">
                      {p.runtime_ms_mean}ms
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Comparative Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="space-y-4">
          <h3 className="text-sm font-bold text-[#E8F2EC]">Waste Units Generated (Lower is Better)</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A4033" />
                <XAxis dataKey="name" stroke="#6B8576" tick={{ fill: "#9EB5A8", fontSize: 11 }} />
                <YAxis stroke="#6B8576" tick={{ fill: "#9EB5A8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#172A20",
                    borderColor: "#2A4033",
                    color: "#E8F2EC",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="wasteUnits" fill="#FF7D78" radius={[4, 4, 0, 0]} name="Waste Units" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <h3 className="text-sm font-bold text-[#E8F2EC]">Net Retail Margin ($) (Higher is Better)</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A4033" />
                <XAxis dataKey="name" stroke="#6B8576" tick={{ fill: "#9EB5A8", fontSize: 11 }} />
                <YAxis stroke="#6B8576" tick={{ fill: "#9EB5A8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#172A20",
                    borderColor: "#2A4033",
                    color: "#E8F2EC",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="margin" fill="#66E3A1" radius={[4, 4, 0, 0]} name="Net Margin ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
