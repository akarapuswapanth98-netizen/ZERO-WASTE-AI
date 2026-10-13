"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  HelpCircle,
  Info,
  Play,
  RefreshCw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionAlternative, api, Recommendation } from "@/lib/api";

export default function PlannerPage() {
  const [loading, setLoading] = useState(true);
  const [runningAgents, setRunningAgents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  // Modals state
  const [selectedForDetails, setSelectedForDetails] = useState<Recommendation | null>(null);
  const [approvalModalRec, setApprovalModalRec] = useState<Recommendation | null>(null);
  const [approvedQuantity, setApprovedQuantity] = useState<number>(1);
  const [approvalReason, setApprovalReason] = useState<string>("");

  const [rejectModalRec, setRejectModalRec] = useState<Recommendation | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // Feedback toast / alert
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecommendations();
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      setError(err.message || "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, []);

  const handleRunAllAgents = async () => {
    setRunningAgents(true);
    setActionAlert(null);
    try {
      const res = await api.runAllAgents();
      setActionAlert({
        type: "success",
        message: `Generated ${res.count} inventory intervention proposals across all active stores.`,
      });
      await loadRecommendations();
    } catch (err: any) {
      setActionAlert({ type: "error", message: err.message || "Failed to run agent coordinator" });
    } finally {
      setRunningAgents(false);
    }
  };

  const openApproveModal = (rec: Recommendation) => {
    setApprovalModalRec(rec);
    setApprovedQuantity(rec.proposed_quantity);
    setApprovalReason("Approved proposed quantity for execution");
  };

  const handleConfirmApproval = async () => {
    if (!approvalModalRec) return;
    try {
      const res = await api.approveProposal(approvalModalRec.id, approvedQuantity, approvalReason);
      if (res.status === "failed") {
        setActionAlert({
          type: "error",
          message: res.message || "Execution failed: Stock changed since recommendation generation.",
        });
      } else {
        setActionAlert({
          type: "success",
          message: `Proposal #${approvalModalRec.id} executed successfully. Stock updated in simulated environment.`,
        });
      }
      setApprovalModalRec(null);
      await loadRecommendations();
    } catch (err: any) {
      setActionAlert({ type: "error", message: err.message || "Failed to execute approval" });
    }
  };

  const openRejectModal = (rec: Recommendation) => {
    setRejectModalRec(rec);
    setRejectionReason("Declined intervention based on alternative commercial judgment");
  };

  const handleConfirmRejection = async () => {
    if (!rejectModalRec) return;
    try {
      await api.rejectProposal(rejectModalRec.id, rejectionReason);
      setActionAlert({
        type: "success",
        message: `Proposal #${rejectModalRec.id} rejected. Verified: ZERO changes executed to stock.`,
      });
      setRejectModalRec(null);
      await loadRecommendations();
    } catch (err: any) {
      setActionAlert({ type: "error", message: err.message || "Failed to reject proposal" });
    }
  };

  const handleBulkApproveLowRisk = async () => {
    const lowRiskPending = recommendations
      .filter((r) => r.status === "pending" && r.risk_level === "Low")
      .map((r) => r.id);

    if (lowRiskPending.length === 0) {
      setActionAlert({ type: "error", message: "No pending Low-risk proposals found for bulk approval." });
      return;
    }

    try {
      const res = await api.bulkApproveLowRisk(lowRiskPending);
      setActionAlert({
        type: "success",
        message: `Bulk-approved ${res.length} Low-risk proposals successfully.`,
      });
      await loadRecommendations();
    } catch (err: any) {
      setActionAlert({ type: "error", message: err.message || "Bulk approval failed" });
    }
  };

  // Filter items
  const filteredRecs = recommendations.filter((r) => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchRisk = riskFilter === "all" || r.risk_level === riskFilter;
    return matchStatus && matchRisk;
  });

  const lowRiskPendingCount = recommendations.filter((r) => r.status === "pending" && r.risk_level === "Low").length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Coordinator Trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">Inventory Planner Center</h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Review, calibrate quantities, and authorize automated agent recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <GlassButton
            variant="secondary"
            size="md"
            onClick={handleBulkApproveLowRisk}
            disabled={lowRiskPendingCount === 0}
            id="btn-bulk-approve-low"
          >
            <CheckCircle2 className="w-4 h-4 mr-1 text-[#66E3A1]" />
            Bulk Approve Low-Risk ({lowRiskPendingCount})
          </GlassButton>

          <GlassButton
            variant="primary"
            size="md"
            onClick={handleRunAllAgents}
            loading={runningAgents}
            id="btn-run-coordinator"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Run Agent Coordinator
          </GlassButton>
        </div>
      </div>

      {/* Action Alert Banner */}
      {actionAlert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between animate-in fade-in ${
            actionAlert.type === "success"
              ? "bg-[#66E3A1]/15 border-[#66E3A1]/40 text-[#66E3A1]"
              : "bg-[#FF7D78]/15 border-[#FF7D78]/40 text-[#FF7D78]"
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {actionAlert.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <GlassPanel className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="text-[#9EB5A8]">Status:</span>
            {["all", "pending", "executed", "rejected", "failed"].map((st) => (
              <button
                key={st}
                id={`filter-status-${st}`}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-[#1C3A2A] text-[#66E3A1] border border-[#66E3A1]/30 font-semibold"
                    : "text-[#9EB5A8] hover:text-[#E8F2EC]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-4 border-l border-[#2A4033]">
            <span className="text-[#9EB5A8]">Risk:</span>
            {["all", "Low", "Medium", "High"].map((rk) => (
              <button
                key={rk}
                id={`filter-risk-${rk}`}
                onClick={() => setRiskFilter(rk)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                  riskFilter === rk
                    ? "bg-[#1C3A2A] text-[#66E3A1] border border-[#66E3A1]/30 font-semibold"
                    : "text-[#9EB5A8] hover:text-[#E8F2EC]"
                }`}
              >
                {rk}
              </button>
            ))}
          </div>
        </div>

        <GlassButton variant="ghost" size="sm" onClick={loadRecommendations}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Refresh
        </GlassButton>
      </GlassPanel>

      {/* Proposals List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-[#172A20] rounded-xl" />
          ))}
        </div>
      ) : filteredRecs.length === 0 ? (
        <GlassPanel className="text-center py-16">
          <Info className="w-12 h-12 text-[#6B8576] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#E8F2EC]">No proposals found</h3>
          <p className="text-xs text-[#9EB5A8] mt-1 mb-4">
            Click &quot;Run Agent Coordinator&quot; to evaluate demand forecasts and generate new proposals.
          </p>
          <GlassButton variant="primary" onClick={handleRunAllAgents} loading={runningAgents}>
            Generate Initial Proposals
          </GlassButton>
        </GlassPanel>
      ) : (
        <div className="space-y-4">
          {filteredRecs.map((rec) => {
            const isPending = rec.status === "pending";
            const isExecuted = rec.status === "executed";
            const isFailed = rec.status === "failed";
            const isRejected = rec.status === "rejected";

            return (
              <GlassCard
                key={rec.id}
                className={`p-5 space-y-4 border transition-all ${
                  isFailed
                    ? "border-[#FF7D78]/50 bg-[#FF7D78]/5"
                    : isPending
                    ? "border-[#2A4033] hover:border-[#66E3A1]/40"
                    : "border-[#2A4033]/60 opacity-90"
                }`}
              >
                {/* Proposal Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={rec.risk_level} />
                    <div>
                      <h3 className="text-base font-bold text-[#E8F2EC] flex items-center gap-2">
                        {rec.product_name || `Product #${rec.product_id}`}
                        <span className="text-xs font-mono text-[#9EB5A8]">({rec.sku})</span>
                      </h3>
                      <p className="text-xs text-[#9EB5A8]">
                        Store: <strong className="text-[#E8F2EC]">{rec.store_name || `Store #${rec.store_id}`}</strong> ·
                        Current Stock: <strong className="text-[#E8F2EC]">{rec.current_stock} units</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={rec.status} />
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedForDetails(rec)}
                      className="text-xs"
                    >
                      Why this action?
                      <HelpCircle className="w-3.5 h-3.5 ml-1" />
                    </GlassButton>
                  </div>
                </div>

                {/* Proposal Core Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-[#101D16]/60 p-3 rounded-xl border border-[#2A4033]">
                  <div>
                    <span className="text-[#9EB5A8]">Proposed Action:</span>
                    <p className="font-bold text-[#66E3A1] text-sm capitalize mt-0.5">
                      {rec.proposed_action.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#9EB5A8]">Quantity:</span>
                    <p className="font-bold text-[#E8F2EC] text-sm mt-0.5">{rec.proposed_quantity} units</p>
                  </div>
                  <div>
                    <span className="text-[#9EB5A8]">Expected Loss:</span>
                    <p className="font-bold text-[#F4B860] text-sm mt-0.5">${rec.expected_loss.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[#9EB5A8]">Waste Avoided:</span>
                    <p className="font-bold text-[#66E3A1] text-sm mt-0.5">{rec.waste_avoided_kg.toFixed(2)} kg</p>
                  </div>
                </div>

                {/* Coordinator Explanation */}
                <p className="text-xs text-[#E8F2EC] bg-[#172A20] p-3 rounded-lg border border-[#2A4033]/80 leading-relaxed font-sans">
                  <strong className="text-[#66E3A1] mr-1.5">Coordinator Rule:</strong>
                  {rec.explanation}
                </p>

                {/* Decision Action Buttons */}
                {isPending && (
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2A4033]/60">
                    <GlassButton
                      variant="danger"
                      size="sm"
                      onClick={() => openRejectModal(rec)}
                      id={`btn-reject-${rec.id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject Proposal
                    </GlassButton>

                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => openApproveModal(rec)}
                      id={`btn-approve-${rec.id}`}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve & Execute
                    </GlassButton>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Approve Modal with Safe Quantity Slider/Input */}
      {approvalModalRec && (
        <GlassModal
          isOpen={true}
          onClose={() => setApprovalModalRec(null)}
          title={`Authorize Intervention: ${approvalModalRec.product_name}`}
          description={`Action: ${approvalModalRec.proposed_action.replace("_", " ").toUpperCase()}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-[#172A20] border border-[#2A4033] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#9EB5A8]">Current On-Hand Stock:</span>
                <span className="font-bold text-[#E8F2EC]">{approvalModalRec.current_stock} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9EB5A8]">Coordinator Proposed Quantity:</span>
                <span className="font-bold text-[#66E3A1]">{approvalModalRec.proposed_quantity} units</span>
              </div>
            </div>

            {/* Quantity adjustment input (safe bound within proposed_quantity) */}
            <div>
              <label className="block text-[#9EB5A8] font-semibold mb-1">
                Approved Quantity (Safe Bounds: 1 to {approvalModalRec.proposed_quantity}):
              </label>
              <GlassInput
                type="number"
                min={1}
                max={approvalModalRec.proposed_quantity}
                value={approvedQuantity}
                onChange={(e) => setApprovedQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full font-mono text-base font-bold text-[#66E3A1]"
                id="input-approved-quantity"
              />
              <p className="text-[11px] text-[#9EB5A8] mt-1">
                You can reduce the approved intervention quantity, but cannot exceed coordinator bounds.
              </p>
            </div>

            {/* Planner Reason */}
            <div>
              <label className="block text-[#9EB5A8] font-semibold mb-1">Planner Approval Note:</label>
              <GlassInput
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Rationale for authorization..."
                className="w-full text-xs"
                id="input-approval-reason"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A4033]">
              <GlassButton variant="ghost" onClick={() => setApprovalModalRec(null)}>
                Cancel
              </GlassButton>
              <GlassButton variant="primary" onClick={handleConfirmApproval} id="btn-confirm-approve">
                Confirm Execution
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* Reject Modal */}
      {rejectModalRec && (
        <GlassModal
          isOpen={true}
          onClose={() => setRejectModalRec(null)}
          title={`Reject Proposal #${rejectModalRec.id}`}
          description="Rejecting ensures that strictly ZERO changes or write-offs are executed."
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[#9EB5A8] font-semibold mb-1">Reason for Rejection:</label>
              <GlassInput
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="State why proposal was rejected..."
                className="w-full text-xs"
                id="input-reject-reason"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A4033]">
              <GlassButton variant="ghost" onClick={() => setRejectModalRec(null)}>
                Cancel
              </GlassButton>
              <GlassButton variant="danger" onClick={handleConfirmRejection} id="btn-confirm-reject">
                Confirm Rejection
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* "Why this action?" Breakdown Modal */}
      {selectedForDetails && (
        <GlassModal
          isOpen={true}
          onClose={() => setSelectedForDetails(null)}
          title="Coordinator Decision Matrix: Why this action?"
          description={`${selectedForDetails.product_name} (${selectedForDetails.sku})`}
        >
          <div className="space-y-4 text-xs max-h-96 overflow-y-auto pr-1">
            <p className="text-[#9EB5A8]">
              The coordinator evaluated all five intervention options, filtered out infeasible actions, and chose the option with the lowest expected financial loss.
            </p>

            <div className="space-y-2">
              <h4 className="font-bold text-[#E8F2EC]">Ranked Alternative Options</h4>
              {selectedForDetails.alternatives.map((opt, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border space-y-1.5 ${
                    opt.action === selectedForDetails.proposed_action
                      ? "bg-[#66E3A1]/15 border-[#66E3A1]/40"
                      : "bg-[#172A20]/60 border-[#2A4033]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#E8F2EC] capitalize">
                      {opt.action.replace("_", " ")}
                      {opt.action === selectedForDetails.proposed_action && (
                        <span className="ml-2 text-xs bg-[#66E3A1] text-[#0B1511] px-2 py-0.5 rounded-full font-bold">
                          Selected Winner
                        </span>
                      )}
                    </span>
                    <span className={opt.is_feasible ? "text-[#66E3A1]" : "text-[#FF7D78]"}>
                      {opt.is_feasible ? "Feasible" : "Infeasible"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[#9EB5A8]">
                    <div>
                      Expected Loss: <strong className="text-[#E8F2EC]">${opt.expected_loss.toFixed(2)}</strong>
                    </div>
                    <div>
                      Waste Avoided: <strong className="text-[#E8F2EC]">{opt.waste_avoided_kg.toFixed(2)} kg</strong>
                    </div>
                  </div>

                  {opt.details?.reason && (
                    <p className="text-[11px] text-[#FF7D78] italic">Filter: {opt.details.reason}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#2A4033] flex justify-end">
              <GlassButton variant="secondary" onClick={() => setSelectedForDetails(null)}>
                Close
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
