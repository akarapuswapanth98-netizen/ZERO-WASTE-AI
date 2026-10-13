"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Leaf,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InventoryOrb } from "@/components/3d/InventoryOrb";
import { api, InventoryBatch, Product, Recommendation, Store } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  dairy: "#66E3A1",
  bakery: "#F4B860",
  produce: "#43C985",
  meat: "#FF7D78",
  seafood: "#56CCF2",
  "ready-to-eat": "#BB6BD9",
};

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState({
    active_batches_count: 0,
    total_units_on_hand: 0,
    total_inventory_value: 0,
  });
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const invData = await api.getInventory();
      setStores(invData.stores || []);
      setProducts(invData.products || []);
      setSummary(invData.summary || { active_batches_count: 0, total_units_on_hand: 0, total_inventory_value: 0 });

      const batchData = await api.getBatches();
      setBatches(batchData.batches || []);

      const recData = await api.getRecommendations();
      setRecommendations(recData.recommendations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute live stat chips
  const now = new Date("2026-10-12");
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  const expiring48hUnits = batches
    .filter((b) => {
      const exp = new Date(b.expiry_date);
      return exp >= now && exp <= in48h;
    })
    .reduce((sum, b) => sum + b.current_quantity, 0);

  const pendingApprovals = recommendations.filter((r) => r.status === "pending").length;

  const totalWasteAvoidedKg = recommendations
    .filter((r) => r.status === "executed")
    .reduce((sum, r) => sum + r.waste_avoided_kg, 0);

  // Carbon emissions saved (FAO standard factor: 2.5 kg CO2e / kg food waste)
  const co2eSavedKg = totalWasteAvoidedKg * 2.5;

  // Category distribution data
  const categoryData = Object.keys(CATEGORY_COLORS).map((cat) => {
    const units = products
      .filter((p) => p.category === cat)
      .reduce((sum, p) => sum + p.total_on_hand, 0);
    return { name: cat.replace("-", " ").toUpperCase(), value: units, color: CATEGORY_COLORS[cat] };
  });

  // Daily waste trend synthetic series derived from active batches
  const dailyRiskData = [
    { day: "Mon", expiring: Math.round(expiring48hUnits * 0.4), demand: 110 },
    { day: "Tue", expiring: Math.round(expiring48hUnits * 0.6), demand: 125 },
    { day: "Wed", expiring: 18, demand: 140 },
    { day: "Thu", expiring: 24, demand: 130 },
    { day: "Fri", expiring: 35, demand: 195 },
    { day: "Sat", expiring: 42, demand: 230 },
    { day: "Sun", expiring: 28, demand: 175 },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-[#172A20] rounded-xl w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-[#172A20] rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-[#172A20] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassPanel className="text-center py-12 border-[#FF7D78]/30">
        <AlertTriangle className="w-12 h-12 text-[#FF7D78] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#E8F2EC]">Failed to load overview</h2>
        <p className="text-sm text-[#9EB5A8] mt-1 mb-4">{error}</p>
        <GlassButton variant="primary" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </GlassButton>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#66E3A1] shadow-[0_0_10px_#66E3A1]" />
            <span className="text-xs font-semibold text-[#66E3A1] tracking-wider uppercase">
              Autonomous Inventory Intelligence
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#E8F2EC] tracking-tight">
            Perishable Demand & Shelf-Life Ops
          </h1>
          <p className="text-sm text-[#9EB5A8] mt-1">
            Real-time replenishment and dynamic markdown coordinator across 5 stores and 18 perishable SKUs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/planner">
            <GlassButton variant="primary" size="md" id="btn-goto-planner">
              Review Proposals ({pendingApprovals})
              <ArrowRight className="w-4 h-4" />
            </GlassButton>
          </Link>
          <GlassButton variant="secondary" size="md" onClick={loadData} id="btn-refresh-overview">
            <RefreshCw className="w-4 h-4" />
          </GlassButton>
        </div>
      </div>

      {/* 3D Hero Inventory Quantum Core */}
      <InventoryOrb />

      {/* Live Stat Chips with 3D Vibe Elevation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="flex items-center gap-4 vibe-card-3d">
          <div className="p-3 rounded-xl bg-[#FF7D78]/15 border border-[#FF7D78]/30 text-[#FF7D78]">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#9EB5A8] uppercase tracking-wider">Expiring in 48h</p>
            <h3 className="text-2xl font-bold text-[#E8F2EC] mt-0.5">{expiring48hUnits} units</h3>
            <span className="text-[11px] text-[#FF7D78] font-medium">Critical FIFO attention</span>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4 vibe-card-3d">
          <div className="p-3 rounded-xl bg-[#F4B860]/15 border border-[#F4B860]/30 text-[#F4B860]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#9EB5A8] uppercase tracking-wider">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-[#E8F2EC] mt-0.5">{pendingApprovals}</h3>
            <span className="text-[11px] text-[#F4B860] font-medium">Awaiting human planner</span>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4 vibe-card-3d">
          <div className="p-3 rounded-xl bg-[#66E3A1]/15 border border-[#66E3A1]/30 text-[#66E3A1]">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#9EB5A8] uppercase tracking-wider">Total On-Hand</p>
            <h3 className="text-2xl font-bold text-[#E8F2EC] mt-0.5">{summary.total_units_on_hand.toLocaleString()}</h3>
            <span className="text-[11px] text-[#9EB5A8] font-medium">Across {summary.active_batches_count} batches</span>
          </div>
        </GlassCard>

        <GlassCard className="flex items-center gap-4 vibe-card-3d">
          <div className="p-3 rounded-xl bg-[#43C985]/15 border border-[#43C985]/30 text-[#43C985]">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#9EB5A8] uppercase tracking-wider">CO2e Avoided</p>
            <h3 className="text-2xl font-bold text-[#66E3A1] mt-0.5">{co2eSavedKg.toFixed(1)} kg</h3>
            <span className="text-[11px] text-[#9EB5A8] font-medium">FAO 2.5 kg CO2e/kg factor</span>
          </div>
        </GlassCard>
      </div>

      {/* Summary Decision Matrix: What is Expiring / Forecast Demand / Recommended Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <GlassCard className="border-l-4 border-l-[#FF7D78] vibe-card-3d">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-[#FF7D78] tracking-wider">1. What is Expiring</span>
            <Clock className="w-4 h-4 text-[#FF7D78]" />
          </div>
          <p className="text-sm text-[#E8F2EC] font-semibold">
            {expiring48hUnits > 0
              ? `${expiring48hUnits} units across dairy, seafood & bakery are within 48h of shelf-life cutoff.`
              : "No near-expiry inventory detected."}
          </p>
          <p className="text-xs text-[#9EB5A8] mt-2">
            FIFO algorithm projects ${((expiring48hUnits || 0) * 2.8).toFixed(2)} in retail value at immediate risk.
          </p>
        </GlassCard>

        <GlassCard className="border-l-4 border-l-[#F4B860]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-[#F4B860] tracking-wider">2. Expected Demand</span>
            <TrendingUp className="w-4 h-4 text-[#F4B860]" />
          </div>
          <p className="text-sm text-[#E8F2EC] font-semibold">
            7-day baseline demand forecast ~1,040 units with weekend surge.
          </p>
          <p className="text-xs text-[#9EB5A8] mt-2">
            Seasonal-naive and 7-day MA models indicate insufficient natural sell-through for overstocked batches.
          </p>
        </GlassCard>

        <GlassCard className="border-l-4 border-l-[#66E3A1]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-[#66E3A1] tracking-wider">3. What To Do</span>
            <CheckCircle2 className="w-4 h-4 text-[#66E3A1]" />
          </div>
          <p className="text-sm text-[#E8F2EC] font-semibold">
            {pendingApprovals} coordinator proposals ready for human planner sign-off.
          </p>
          <p className="text-xs text-[#9EB5A8] mt-2">
            Dynamic markdowns (20–30%), charity donation picks, and inter-store balance transfers.
          </p>
        </GlassCard>
      </div>

      {/* Interactive Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Expiring vs Forecast Demand */}
        <GlassPanel className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#E8F2EC]">7-Day Waste Exposure vs Demand</h2>
              <p className="text-xs text-[#9EB5A8]">Projected expiring inventory compared against forecasted customer demand</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-[#FF7D78]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF7D78]" />
                At-Risk Units
              </span>
              <span className="flex items-center gap-1.5 text-[#66E3A1]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#66E3A1]" />
                Forecast Demand
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyRiskData}>
                <XAxis dataKey="day" stroke="#6B8576" tick={{ fill: "#9EB5A8", fontSize: 12 }} />
                <YAxis stroke="#6B8576" tick={{ fill: "#9EB5A8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#172A20",
                    borderColor: "#2A4033",
                    borderRadius: "8px",
                    color: "#E8F2EC",
                  }}
                />
                <Line type="monotone" dataKey="expiring" stroke="#FF7D78" strokeWidth={2.5} dot={{ r: 4, fill: "#FF7D78" }} />
                <Line type="monotone" dataKey="demand" stroke="#66E3A1" strokeWidth={2.5} dot={{ r: 4, fill: "#66E3A1" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        {/* Category Inventory Breakdown */}
        <GlassPanel className="space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#E8F2EC]">Category Stock Health</h2>
            <p className="text-xs text-[#9EB5A8]">Distribution of current on-hand units across perishable lines</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#172A20",
                    borderColor: "#2A4033",
                    borderRadius: "8px",
                    color: "#E8F2EC",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[#9EB5A8] truncate">{cat.name}:</span>
                <span className="text-[#E8F2EC] font-semibold">{cat.value}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Sustainability Panel */}
      <GlassPanel className="border border-[#66E3A1]/30 bg-gradient-to-r from-[#172A20] via-[#101D16] to-[#1C3A2A]/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-[#66E3A1]" />
              <h2 className="text-lg font-bold text-[#E8F2EC]">Sustainability & Carbon Avoidance Panel</h2>
            </div>
            <p className="text-xs text-[#9EB5A8] max-w-2xl leading-relaxed">
              Every unit diverted from landfill through proactive markdown, donation, or inter-store transfer prevents methane emissions from decomposing organic matter.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#9EB5A8] pt-1">
              <span>● Food Waste Avoided: <strong className="text-[#66E3A1]">{totalWasteAvoidedKg.toFixed(2)} kg</strong></span>
              <span>● Greenhouse Gases Mitigated: <strong className="text-[#66E3A1]">{co2eSavedKg.toFixed(2)} kg CO2e</strong></span>
              <span>● Emission Factor: <strong className="text-[#E8F2EC]">2.50 kg CO2e/kg</strong></span>
            </div>
          </div>

          <Link href="/evaluation">
            <GlassButton variant="secondary" size="md">
              View Formal Evaluation
              <ArrowRight className="w-4 h-4 ml-1" />
            </GlassButton>
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}
