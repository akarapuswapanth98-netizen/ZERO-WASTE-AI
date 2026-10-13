"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Scale,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { api, ScenarioPolicyResult } from "@/lib/api";

export default function EvaluationPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    evaluation_period_days: number;
    sample_size_seeds: number;
    formulas: Record<string, string>;
    modelling_assumptions: string[];
    benchmark_policies: ScenarioPolicyResult[];
  } | null>(null);

  useEffect(() => {
    api
      .getEvaluation()
      .then((res) => setData(res))
      .catch((err) => console.error("Evaluation load failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadCsv = () => {
    window.location.href = "/api/evaluation/export-csv";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">System Evaluation & Baselines</h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Empirical benchmark metrics, mathematical formulations, and modelling assumptions.
          </p>
        </div>

        <GlassButton variant="primary" size="md" onClick={handleDownloadCsv} id="btn-export-evaluation-csv">
          <Download className="w-4 h-4 mr-2" />
          Export Benchmark CSV
        </GlassButton>
      </div>

      {/* Benchmark Summary Table */}
      <GlassPanel className="p-0 overflow-hidden">
        <div className="p-5 border-b border-[#2A4033] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#E8F2EC] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#66E3A1]" />
              Baseline Comparisons (Canonical 14-Day Evaluation)
            </h2>
            <p className="text-xs text-[#9EB5A8]">
              Evaluated across {data?.sample_size_seeds || 5} seeded replications on identical demand draws.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="table-evaluation-metrics">
            <thead className="bg-[#101D16]/90 border-b border-[#2A4033] text-[11px] font-semibold text-[#9EB5A8] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Policy</th>
                <th className="px-4 py-3.5 text-right">Waste Units</th>
                <th className="px-4 py-3.5 text-right">Waste Cost ($)</th>
                <th className="px-4 py-3.5 text-right">Stockout Units</th>
                <th className="px-4 py-3.5 text-right">Service Level</th>
                <th className="px-4 py-3.5 text-right">Net Margin ($)</th>
                <th className="px-4 py-3.5 text-right">Reduction vs FIFO</th>
                <th className="px-4 py-3.5 text-right">Sim Runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A4033]/60">
              {data?.benchmark_policies.map((p) => {
                const isAgentic = p.policy_name === "Agentic";
                return (
                  <tr
                    key={p.policy_name}
                    className={`hover:bg-[#1C3A2A]/40 transition-colors ${
                      isAgentic ? "bg-[#66E3A1]/5 font-semibold" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-bold text-[#E8F2EC] flex items-center gap-2">
                      {p.policy_name}
                      {isAgentic && (
                        <span className="text-[10px] bg-[#66E3A1] text-[#0B1511] px-1.5 py-0.5 rounded font-bold">
                          AGENTIC
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#E8F2EC]">{p.waste_units_mean}</td>
                    <td className="px-4 py-3.5 text-right text-[#E8F2EC]">${p.waste_cost_mean.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right text-[#FF7D78]">{p.stockout_units_mean}</td>
                    <td className="px-4 py-3.5 text-right text-[#66E3A1]">{p.service_level_pct_mean.toFixed(1)}%</td>
                    <td className="px-4 py-3.5 text-right text-[#E8F2EC] font-bold">${p.net_margin_mean.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-[#66E3A1] bg-[#66E3A1]/15 px-2 py-0.5 rounded font-bold">
                        {p.waste_reduction_pct}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#9EB5A8] font-mono">{p.runtime_ms_mean}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Formulations & Modelling Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#66E3A1]" />
            <h3 className="text-sm font-bold text-[#E8F2EC]">Mathematical Formulations</h3>
          </div>
          <div className="space-y-2.5 text-xs text-[#9EB5A8]">
            {data &&
              Object.entries(data.formulas).map(([key, formula]) => (
                <div key={key} className="p-3 rounded-xl bg-[#101D16]/80 border border-[#2A4033]">
                  <strong className="text-[#66E3A1] block font-mono">{key}:</strong>
                  <span className="text-[#E8F2EC] font-mono mt-0.5 block">{formula}</span>
                </div>
              ))}
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#F4B860]" />
            <h3 className="text-sm font-bold text-[#E8F2EC]">Explicit Modelling Assumptions</h3>
          </div>
          <div className="space-y-2 text-xs text-[#9EB5A8]">
            <p className="leading-relaxed">
              In accordance with hackathon rules, all assumptions are explicitly labelled in deterministic calculations:
            </p>
            <ul className="space-y-2 pt-1">
              {data?.modelling_assumptions.map((asm, idx) => (
                <li key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#101D16]/60 border border-[#2A4033]">
                  <span className="text-[#66E3A1] font-bold">✓</span>
                  <span className="text-[#E8F2EC]">{asm}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
