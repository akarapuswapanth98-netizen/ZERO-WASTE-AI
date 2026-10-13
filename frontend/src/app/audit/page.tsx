"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  Code,
  FileText,
  Filter,
  RefreshCw,
  ScrollText,
  Server,
  UserCheck,
  X,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { api, AuditLog, SimEvent } from "@/lib/api";

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<"logs" | "events">("logs");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // JSON inspect drawer
  const [inspectPayload, setInspectPayload] = useState<{ title: string; json: any } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, eventsData] = await Promise.all([api.getAuditLogs(50), api.getSimEvents(50)]);
      setLogs(logsData.logs || []);
      setEvents(eventsData.events || []);
    } catch (err) {
      console.error("Audit load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">Audit Trail & Integration Logs</h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Immutable log of human planner decisions and simulated POS, WMS, and ERP adapter events.
          </p>
        </div>

        <GlassButton variant="secondary" size="md" onClick={loadData} id="btn-refresh-audit">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Stream
        </GlassButton>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2A4033] pb-3">
        <button
          onClick={() => setActiveTab("logs")}
          id="tab-audit-logs"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "logs"
              ? "bg-[#66E3A1] text-[#0B1511] shadow-glow"
              : "text-[#9EB5A8] hover:text-[#E8F2EC] hover:bg-[#172A20]"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Planner Decision Logs ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab("events")}
          id="tab-sim-events"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "events"
              ? "bg-[#66E3A1] text-[#0B1511] shadow-glow"
              : "text-[#9EB5A8] hover:text-[#E8F2EC] hover:bg-[#172A20]"
          }`}
        >
          <Server className="w-4 h-4" />
          Simulated Adapter Events ({events.length})
        </button>
      </div>

      {/* Logs Table / Stream */}
      <GlassPanel className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#9EB5A8] animate-pulse">Loading audit streams...</div>
        ) : activeTab === "logs" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="table-audit-logs">
              <thead className="bg-[#101D16]/90 border-b border-[#2A4033] text-[11px] font-semibold text-[#9EB5A8] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Details Summary</th>
                  <th className="px-4 py-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A4033]/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#9EB5A8]">
                      No audit records found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1C3A2A]/40 transition-colors">
                      <td className="px-5 py-3 text-[#9EB5A8] font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#66E3A1]">{log.action_type}</td>
                      <td className="px-4 py-3 text-[#E8F2EC] capitalize">
                        {log.entity_type} #{log.entity_id}
                      </td>
                      <td className="px-4 py-3 text-[#9EB5A8]">{log.actor}</td>
                      <td className="px-4 py-3 text-[#E8F2EC] max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setInspectPayload({
                              title: `Audit Log #${log.id}: ${log.action_type}`,
                              json: log.details,
                            })
                          }
                          className="text-[#66E3A1]"
                        >
                          <Code className="w-3.5 h-3.5 mr-1" />
                          JSON
                        </GlassButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="table-sim-events">
              <thead className="bg-[#101D16]/90 border-b border-[#2A4033] text-[11px] font-semibold text-[#9EB5A8] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Subsystem</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Payload Summary</th>
                  <th className="px-4 py-3 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A4033]/60">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[#9EB5A8]">
                      No simulated integration events recorded.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-[#1C3A2A]/40 transition-colors">
                      <td className="px-5 py-3 text-[#9EB5A8] font-mono">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#E8F2EC]">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                            evt.system_name === "POS"
                              ? "bg-[#66E3A1]/20 text-[#66E3A1]"
                              : evt.system_name === "WMS"
                              ? "bg-[#56CCF2]/20 text-[#56CCF2]"
                              : "bg-[#F4B860]/20 text-[#F4B860]"
                          }`}
                        >
                          {evt.system_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#E8F2EC]">{evt.event_type}</td>
                      <td className="px-4 py-3 text-[#9EB5A8] max-w-sm truncate">
                        {JSON.stringify(evt.payload)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setInspectPayload({
                              title: `${evt.system_name} Event #${evt.id}: ${evt.event_type}`,
                              json: evt.payload,
                            })
                          }
                          className="text-[#66E3A1]"
                        >
                          <Code className="w-3.5 h-3.5 mr-1" />
                          JSON
                        </GlassButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {/* JSON Payload Inspect Drawer */}
      {inspectPayload && (
        <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#101D16]/95 backdrop-blur-2xl border-l border-[#2A4033] shadow-2xl z-50 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div className="space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#2A4033] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#E8F2EC]">{inspectPayload.title}</h3>
                <span className="text-[11px] text-[#66E3A1]">Synthetic Integration Audit Payload</span>
              </div>
              <button
                onClick={() => setInspectPayload(null)}
                className="p-1 text-[#9EB5A8] hover:text-[#E8F2EC] rounded-lg hover:bg-[#172A20]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-[#0B1511] border border-[#2A4033] text-[#66E3A1] font-mono text-xs overflow-x-auto leading-relaxed">
              {JSON.stringify(inspectPayload.json, null, 2)}
            </pre>
          </div>

          <div className="pt-4 border-t border-[#2A4033]">
            <GlassButton variant="secondary" className="w-full" onClick={() => setInspectPayload(null)}>
              Close Inspector
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
