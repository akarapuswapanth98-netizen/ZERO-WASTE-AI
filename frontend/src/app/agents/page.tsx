"use client";

import React, { useEffect, useState } from "react";
import {
  Cpu,
  Sparkles,
  Bot,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  GitCompare,
  TrendingDown,
  CheckCircle2,
  DollarSign,
  Leaf,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, Product, Store, Recommendation } from "@/lib/api";

const AGENT_PERSONAS = [
  {
    name: "DemandAgent",
    role: "Perishable Demand Forecaster",
    desc: "Runs multi-model tournament (Seasonal-Naive, 7-day MA, SES) and generates 80% confidence bands.",
    badge: "ML Engine",
    color: "#66E3A1",
  },
  {
    name: "SpoilageRiskAgent",
    role: "FIFO Expiration Auditor",
    desc: "Simulates batch-level FIFO depletion and classifies risk as Low, Medium, or High.",
    badge: "Risk Engine",
    color: "#FF7D78",
  },
  {
    name: "InventoryAgent",
    role: "Supply & Pipeline Auditor",
    desc: "Audits on-hand stock and prevents replenishment orders when positions are High risk.",
    badge: "WMS / ERP",
    color: "#F4B860",
  },
  {
    name: "RecommendationAgent",
    role: "Candidate Action Generator",
    desc: "Evaluates markdowns (10–50%), donations, and inter-store balance transfers.",
    badge: "Optimization",
    color: "#38BDF8",
  },
  {
    name: "CoordinatorAgent",
    role: "Deterministic Safety Arbiter",
    desc: "Enforces strict quantity safety bounds [0, on_hand] and applies deterministic tie-breaking.",
    badge: "Deterministic",
    color: "#BB6BD9",
  },
];

export default function AgentsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<number>(1);

  const [activeProposal, setActiveProposal] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
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

  const runAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.runAgents(selectedStoreId, selectedProductId);
      setActiveProposal(res);
    } catch (err: any) {
      setError(err.message || "Failed to run agent coordination");
    } finally {
      setLoading(false);
    }
  };

  const runNetworkCoordination = async () => {
    setRunningAll(true);
    try {
      await api.runAllAgents();
      await runAgents();
    } catch (err: any) {
      setError(err.message || "Network coordination failed");
    } finally {
      setRunningAll(false);
    }
  };

  useEffect(() => {
    if (selectedStoreId && selectedProductId) {
      runAgents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedProductId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#66E3A1] shadow-[0_0_10px_#66E3A1]" />
            <span className="text-xs font-semibold text-[#66E3A1] tracking-wider uppercase">
              Agent Command Center
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">
            5-Agent Deliberation & Counterfactual Replay
          </h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Deterministic coordinator orchestrating Demand, Spoilage, Inventory, and Recommendation agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="secondary"
            size="md"
            onClick={runAgents}
            disabled={loading}
            id="btn-run-single-agent"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Deliberate SKU
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            onClick={runNetworkCoordination}
            disabled={runningAll}
            id="btn-run-network-agents"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {runningAll ? "Coordinating..." : "Trigger Network Run"}
          </GlassButton>
        </div>
      </div>

      {/* Control Selector Panel */}
      <GlassPanel className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#9EB5A8] block mb-1.5 font-medium">Select Store:</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(parseInt(e.target.value, 10))}
              id="select-agents-store"
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
              id="select-agents-product"
              className="w-full bg-[#101D16] border border-[#2A4033] rounded-xl px-3 py-2 text-sm text-[#E8F2EC] focus:border-[#66E3A1] focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — {p.category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassPanel>

      {/* 5-Agent Architecture Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {AGENT_PERSONAS.map((agent, idx) => (
          <GlassCard key={idx} className="p-3.5 vibe-card-3d border-[#2A4033]">
            <div className="flex items-center justify-between mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
              <span className="text-[9px] font-mono uppercase bg-[#101D16] px-1.5 py-0.5 rounded border border-[#2A4033] text-[#A3C2B0]">
                {agent.badge}
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#E8F2EC]">{agent.name}</h4>
            <p className="text-[10px] text-[#66E3A1] font-mono mt-0.5">{agent.role}</p>
            <p className="text-[11px] text-[#A3C2B0] mt-2 leading-tight">{agent.desc}</p>
          </GlassCard>
        ))}
      </div>

      {/* Counterfactual Replay Diff Panel */}
      {activeProposal && (
        <GlassPanel className="p-5 border-l-4 border-l-[#66E3A1]">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#2A4033]">
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#66E3A1]" />
              <h3 className="text-base font-bold text-[#E8F2EC]">
                Counterfactual Decision Replay
              </h3>
            </div>
            <span className="text-xs font-mono bg-[#172A20] text-[#66E3A1] px-2.5 py-1 rounded-lg border border-[#66E3A1]/30">
              Proposal #{activeProposal.id}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: What if No Action is taken? */}
            <div className="bg-[#101D16]/90 p-4 rounded-xl border border-[#FF7D78]/30">
              <span className="text-[11px] font-bold uppercase text-[#FF7D78] tracking-wider block mb-1">
                Counterfactual: No Intervention Taken
              </span>
              <p className="text-xs text-[#A3C2B0] mb-3">
                Items remain at full price until expiry passes without promotional markdown or donation.
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[#2A4033]/40">
                  <span className="text-[#A3C2B0]">Direct Landfill Waste:</span>
                  <span className="text-[#FF7D78] font-bold">
                    {activeProposal.proposed_quantity} units
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2A4033]/40">
                  <span className="text-[#A3C2B0]">Financial Write-Off:</span>
                  <span className="text-[#FF7D78] font-bold">
                    ${activeProposal.expected_loss.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#A3C2B0]">Carbon Diverted:</span>
                  <span className="text-[#A3C2B0]">0.0 kg CO2e</span>
                </div>
              </div>
            </div>

            {/* Right: Agent Coordinator Proposal */}
            <div className="bg-[#1C3A2A]/70 p-4 rounded-xl border border-[#66E3A1]/40 shadow-[0_0_20px_rgba(102,227,161,0.1)]">
              <span className="text-[11px] font-bold uppercase text-[#66E3A1] tracking-wider block mb-1">
                Optimized Agent Intervention
              </span>
              <p className="text-xs text-[#D6E6DC] mb-3">{activeProposal.explanation}</p>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-[#2A4033]/60">
                  <span className="text-[#A3C2B0]">Recommended Action:</span>
                  <span className="text-[#66E3A1] font-bold uppercase">
                    {activeProposal.proposed_action.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#2A4033]/60">
                  <span className="text-[#A3C2B0]">Food Waste Diverted:</span>
                  <span className="text-[#66E3A1] font-bold">
                    {activeProposal.waste_avoided_kg.toFixed(2)} kg
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#A3C2B0]">Estimated Net Recovery:</span>
                  <span className="text-[#66E3A1] font-bold">
                    ${Math.max(0, -activeProposal.cost_impact).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Alternatives Comparison Matrix */}
      {activeProposal && activeProposal.alternatives && (
        <GlassPanel className="p-5">
          <h3 className="text-base font-bold text-[#E8F2EC] mb-3">
            Ranked Action Alternatives Evaluated by Coordinator
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#2A4033] text-[#A3C2B0] uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-3">Candidate Action</th>
                  <th className="py-2 px-3">Feasibility</th>
                  <th className="py-2 px-3 text-right">Expected Loss</th>
                  <th className="py-2 px-3 text-right">Waste Avoided</th>
                  <th className="py-2 px-3 text-right">Cost Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A4033]/40">
                {activeProposal.alternatives.map((alt, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-[#1C3A2A]/40 transition-colors ${
                      alt.action === activeProposal.proposed_action ? "bg-[#1C3A2A]/30" : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-[#E8F2EC] uppercase">
                      {alt.action.replace("_", " ")}
                      {alt.action === activeProposal.proposed_action && (
                        <span className="ml-2 text-[10px] bg-[#66E3A1] text-[#0B1511] font-bold px-1.5 py-0.5 rounded">
                          Selected
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {alt.is_feasible ? (
                        <span className="text-[#66E3A1]">Feasible</span>
                      ) : (
                        <span className="text-[#FF7D78]">Violates Bounds</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#E8F2EC]">
                      ${alt.expected_loss.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#66E3A1]">
                      {alt.waste_avoided_kg.toFixed(2)} kg
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#A3C2B0]">
                      ${alt.cost_impact.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
