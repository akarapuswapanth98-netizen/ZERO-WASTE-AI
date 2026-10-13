"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Clock,
  Calendar,
  AlertTriangle,
  TrendingDown,
  Layers,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, SpoilageRiskResponse, Product, Store, InventoryBatch } from "@/lib/api";

export default function SpoilageRiskPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<number>(1);
  const [dayOffset, setDayOffset] = useState<number>(0);

  const [riskData, setRiskData] = useState<SpoilageRiskResponse | null>(null);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
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

  const fetchRisk = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRisk(selectedStoreId, selectedProductId, dayOffset);
      setRiskData(res);

      const bRes = await api.getBatches(selectedStoreId, selectedProductId);
      setBatches(bRes.batches || []);
    } catch (err: any) {
      setError(err.message || "Failed to load risk analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId && selectedProductId) {
      fetchRisk();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedProductId, dayOffset]);

  const riskColor =
    riskData?.risk_level === "High"
      ? "#FF7D78"
      : riskData?.risk_level === "Medium"
      ? "#F4B860"
      : "#66E3A1";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF7D78] shadow-[0_0_10px_#FF7D78]" />
            <span className="text-xs font-semibold text-[#FF7D78] tracking-wider uppercase">
              Spoilage Risk & Shelf-Life Time Travel
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">
            FIFO Depletion & Spoilage Simulator
          </h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Test inventory aging day-by-day (0–7 days offset) against 80% forecast demand envelopes.
          </p>
        </div>

        <GlassButton variant="secondary" size="md" onClick={fetchRisk} id="btn-refresh-risk">
          <RefreshCw className="w-4 h-4 mr-2" />
          Recompute Risk
        </GlassButton>
      </div>

      {/* Control Selector Panel */}
      <GlassPanel className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-[#9EB5A8] block mb-1.5 font-medium">Select Store:</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(parseInt(e.target.value, 10))}
              id="select-risk-store"
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
              id="select-risk-product"
              className="w-full bg-[#101D16] border border-[#2A4033] rounded-xl px-3 py-2 text-sm text-[#E8F2EC] focus:border-[#66E3A1] focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#9EB5A8] font-medium">Time-Travel Horizon:</label>
              <span className="text-xs font-bold text-[#66E3A1] font-mono">
                +{dayOffset} {dayOffset === 1 ? "day" : "days"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              value={dayOffset}
              onChange={(e) => setDayOffset(parseInt(e.target.value, 10))}
              id="slider-risk-offset"
              className="w-full accent-[#66E3A1] cursor-pointer mt-1"
            />
          </div>
        </div>
      </GlassPanel>

      {/* Risk Metrics Cards */}
      {riskData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 vibe-card-3d">
            <span className="text-xs text-[#A3C2B0] block uppercase tracking-wider">Risk Classification</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-2xl font-extrabold"
                style={{ color: riskColor }}
              >
                {riskData.risk_level}
              </span>
              <StatusBadge status={riskData.risk_level} />
            </div>
            <span className="text-[11px] text-[#A3C2B0] block mt-1">
              Ratio: {(riskData.risk_ratio * 100).toFixed(1)}% of on-hand stock
            </span>
          </GlassCard>

          <GlassCard className="p-4 vibe-card-3d">
            <span className="text-xs text-[#A3C2B0] block uppercase tracking-wider">At-Risk Units</span>
            <h3 className="text-2xl font-bold text-[#E8F2EC] mt-1">{riskData.at_risk_units} units</h3>
            <span className="text-[11px] text-[#FF7D78] block mt-1">
              80% Range: {riskData.at_risk_range_min} – {riskData.at_risk_range_max} units
            </span>
          </GlassCard>

          <GlassCard className="p-4 vibe-card-3d">
            <span className="text-xs text-[#A3C2B0] block uppercase tracking-wider">Current On-Hand</span>
            <h3 className="text-2xl font-bold text-[#E8F2EC] mt-1">{riskData.on_hand_units} units</h3>
            <span className="text-[11px] text-[#66E3A1] block mt-1">
              Active Stock Position
            </span>
          </GlassCard>

          <GlassCard className="p-4 vibe-card-3d">
            <span className="text-xs text-[#A3C2B0] block uppercase tracking-wider">Time Offset</span>
            <h3 className="text-2xl font-bold text-[#66E3A1] mt-1 font-mono">+{dayOffset} Days</h3>
            <span className="text-[11px] text-[#A3C2B0] block mt-1">
              Simulated Date: {riskData.as_of_date}
            </span>
          </GlassCard>
        </div>
      )}

      {/* Explanation Banner */}
      {riskData && (
        <GlassCard className="p-4 border-l-4" style={{ borderLeftColor: riskColor }}>
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: riskColor }} />
            <div>
              <h4 className="text-sm font-bold text-[#E8F2EC]">Coordinator Risk Rationale</h4>
              <p className="text-xs text-[#A3C2B0] mt-1 leading-relaxed">{riskData.reason}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Physical FIFO Batches Table */}
      <GlassPanel className="p-5">
        <h3 className="text-base font-bold text-[#E8F2EC] mb-3">
          Active Store Batches Awaiting FIFO Depletion
        </h3>
        {batches.length === 0 ? (
          <p className="text-xs text-[#A3C2B0] py-4 text-center">No active batches for this SKU.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#2A4033] text-[#A3C2B0] uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-3">Batch Code</th>
                  <th className="py-2 px-3">Received Date</th>
                  <th className="py-2 px-3">Expiry Date</th>
                  <th className="py-2 px-3 text-right">Current Qty</th>
                  <th className="py-2 px-3 text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A4033]/40">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#1C3A2A]/40 transition-colors">
                    <td className="py-2 px-3 font-mono text-[#66E3A1]">{b.batch_code}</td>
                    <td className="py-2 px-3 text-[#A3C2B0]">{b.received_date}</td>
                    <td className="py-2 px-3 font-semibold text-[#E8F2EC]">{b.expiry_date}</td>
                    <td className="py-2 px-3 text-right font-bold text-[#E8F2EC]">
                      {b.current_quantity} units
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#A3C2B0]">
                      ${b.unit_cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
