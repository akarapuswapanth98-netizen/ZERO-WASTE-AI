"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Award,
  Calendar,
  Layers,
  Store as StoreIcon,
  Package,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  CartesianGrid,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, ForecastResponse, Product, Store } from "@/lib/api";

export default function ForecastPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<number>(1);
  const [horizonDays, setHorizonDays] = useState<number>(7);

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInventory()
      .then((data) => {
        setStores(data.stores || []);
        setProducts(data.products || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getForecast(selectedStoreId, selectedProductId, horizonDays);
      setForecast(data);
    } catch (err: any) {
      setError(err.message || "Failed to load forecast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId && selectedProductId) {
      fetchForecast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedProductId, horizonDays]);

  // Format chart data with intervals
  const chartData =
    forecast?.forecast_dates.map((dateStr, idx) => ({
      date: dateStr.substring(5), // MM-DD
      point: forecast.point_forecast[idx],
      lower: forecast.lower_bound[idx],
      upper: forecast.upper_bound[idx],
      band: [forecast.lower_bound[idx], forecast.upper_bound[idx]],
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#66E3A1] shadow-[0_0_10px_#66E3A1]" />
            <span className="text-xs font-semibold text-[#66E3A1] tracking-wider uppercase">
              Forecasting Tournament Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">
            Perishable Demand Tourney & 80% Intervals
          </h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Hold-out validation across Seasonal-Naive, 7-day MA, and Simple Exponential Smoothing.
          </p>
        </div>

        <GlassButton variant="secondary" size="md" onClick={fetchForecast} id="btn-refresh-forecast">
          <RefreshCw className="w-4 h-4 mr-2" />
          Rerun Evaluation
        </GlassButton>
      </div>

      {/* Control Selector Panel */}
      <GlassPanel className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#9EB5A8] block mb-1.5 font-medium">Select Retail Store:</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(parseInt(e.target.value, 10))}
              id="select-forecast-store"
              className="w-full bg-[#101D16] border border-[#2A4033] rounded-xl px-3 py-2 text-sm text-[#E8F2EC] focus:border-[#66E3A1] focus:outline-none"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#9EB5A8] block mb-1.5 font-medium">Perishable SKU:</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(parseInt(e.target.value, 10))}
              id="select-forecast-product"
              className="w-full bg-[#101D16] border border-[#2A4033] rounded-xl px-3 py-2 text-sm text-[#E8F2EC] focus:border-[#66E3A1] focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — {p.category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#9EB5A8] block mb-1.5 font-medium">Forecast Horizon:</label>
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(parseInt(e.target.value, 10))}
              id="select-forecast-horizon"
              className="w-full bg-[#101D16] border border-[#2A4033] rounded-xl px-3 py-2 text-sm text-[#E8F2EC] focus:border-[#66E3A1] focus:outline-none"
            >
              <option value={7}>7 Days (Perishable Standard)</option>
              <option value={14}>14 Days (Extended)</option>
            </select>
          </div>
        </div>
      </GlassPanel>

      {/* 3-Model Tournament Leaderboard */}
      {forecast && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forecast.candidate_metrics.map((model, idx) => (
            <GlassCard
              key={idx}
              className={`p-4 relative vibe-card-3d ${
                model.is_winner
                  ? "border-[#66E3A1] bg-gradient-to-b from-[#1C3A2A]/80 to-[#172A20]/80 shadow-[0_0_25px_rgba(102,227,161,0.2)]"
                  : "border-[#2A4033]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-[#E8F2EC]">{model.model_name}</span>
                {model.is_winner && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-[#66E3A1] text-[#0B1511] px-2 py-0.5 rounded-full">
                    <Award className="w-3 h-3" /> Winner
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#2A4033]/60 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-[#A3C2B0] block uppercase">Hold-Out MAE:</span>
                  <span className="text-base font-bold text-[#E8F2EC]">{model.mae.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A3C2B0] block uppercase">Hold-Out WAPE:</span>
                  <span className="text-base font-bold text-[#66E3A1]">
                    {(model.wape * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* 80% Prediction Interval Chart */}
      <GlassPanel className="p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2A4033]">
          <div>
            <h3 className="text-base font-bold text-[#E8F2EC]">
              7-Day Point Forecast & 80% Confidence Band
            </h3>
            <p className="text-xs text-[#A3C2B0]">
              Upper & lower bounds computed directly from empirical hold-out residuals
            </p>
          </div>
          {forecast && (
            <span className="text-xs font-mono bg-[#101D16] px-2.5 py-1 rounded-lg border border-[#2A4033] text-[#66E3A1]">
              Engine Winner: {forecast.winner_model}
            </span>
          )}
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="intervalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#66E3A1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#66E3A1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A4033" opacity={0.5} />
              <XAxis dataKey="date" stroke="#9EB5A8" fontSize={11} />
              <YAxis stroke="#9EB5A8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#101D16",
                  borderColor: "#2A4033",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="#43C985"
                strokeDasharray="4 4"
                fillOpacity={0.15}
                fill="#66E3A1"
                name="80% Upper Bound"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="#43C985"
                strokeDasharray="4 4"
                fillOpacity={0}
                fill="none"
                name="80% Lower Bound"
              />
              <Line
                type="monotone"
                dataKey="point"
                stroke="#66E3A1"
                strokeWidth={3}
                dot={{ r: 4, fill: "#66E3A1" }}
                name="Point Forecast (units)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      {/* Mathematical Rigor Note */}
      <GlassCard className="p-4 border-l-4 border-l-[#66E3A1] flex items-start gap-3">
        <Info className="w-5 h-5 text-[#66E3A1] shrink-0 mt-0.5" />
        <div className="text-xs text-[#A3C2B0] space-y-1">
          <p className="font-semibold text-[#E8F2EC]">Deterministic Multi-Model Selection Rules:</p>
          <p>
            The engine splits 84 days of sales history, holding out the final 7 days as an out-of-sample test window.
            Candidate models are fitted on days 1–77 and evaluated on days 78–84 using Mean Absolute Error (MAE) and WAPE.
            The winning model is chosen automatically per SKU-store series; in case of ties within 1%, Seasonal-Naive is preferred to conserve computational overhead.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
