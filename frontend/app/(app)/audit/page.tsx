"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { EmptyPanel, ErrorPanel, GlassButton, GlassCard, Skeleton } from "@/components/glass";
import { API_BASE, api } from "@/lib/api";
import { errMsg, type AuditData, type AuditRow, type Status } from "@/lib/types";

const PAGE_SIZE = 25;

function summaryOf(row: AuditRow): string {
  const d = (row.details ?? row.payload) as Record<string, unknown> | undefined;
  const id = String(row.entity_id ?? "");
  const short = id ? id.slice(-6) : "";
  const action = String(row.action ?? row.event_type ?? "");
  if (row.entity === "recommendation" && d && typeof d === "object") {
    const act = String(d.action_type ?? d.action ?? "").replace(/-/g, " ");
    const sku = String(d.sku ?? "");
    const store = String(d.store_id ?? "");
    const qty = d.quantity ?? d.qty;
    const what = [act, typeof qty === "number" ? `x${qty}` : "", sku, store ? `@ ${store}` : ""].filter(Boolean).join(" ");
    if (action === "approve") return `Approved ${what} (${short})`;
    if (action === "reject") return `Rejected ${what} (${short}) — nothing executed`;
    if (action === "propose") return `Proposed ${what} (${short})`;
    if (action === "execute") return `Executed ${what} in simulation (${short})`;
    if (action === "supersede") return `Superseded older proposal for ${sku} @ ${store}`;
  }
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    const keys = ["decision", "action", "result", "status", "reason", "preset", "seed"].filter((k) => o[k] !== undefined);
    if (keys.length > 0) return keys.map((k) => `${k}: ${String(o[k]).slice(0, 40)}`).join(" · ");
    return JSON.stringify(d).slice(0, 120);
  }
  return String(d ?? action).slice(0, 120);
}

function LogTable({ title, rows }: { title: string; rows: AuditRow[] }) {
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const actors = useMemo(() => [...new Set(rows.map((r) => String(r.actor ?? r.source ?? "?")))].sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const who = String(r.actor ?? r.source ?? "");
      if (actor && who !== actor) return false;
      if (needle && !JSON.stringify(r).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, actor, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const keyOf = (r: AuditRow, i: number) => String(r.log_id ?? r.event_id ?? r.run_id ?? i);
  return (
    <GlassCard className="!p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold">{title} ({filtered.length})</h2>
        <select value={actor} onChange={(e) => { setActor(e.target.value); setPage(0); }} className="glass-input ml-auto" aria-label={`${title} actor filter`}>
          <option value="">All actors</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search" className="glass-input" aria-label={`${title} search`} />
      </div>
      <div className="mt-2 overflow-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left uppercase opacity-50"><th className="p-1">Time</th><th className="p-1">Actor</th><th className="p-1">Action</th><th className="p-1">Entity</th><th className="p-1">Summary</th><th className="p-1">Status</th><th className="p-1" /></tr></thead>
          <tbody>
            {slice.map((r, i) => {
              const id = keyOf(r, i);
              return (
                <Fragment key={id}>
                  <tr key={id} className="border-t border-white/10 align-top">
                    <td className="whitespace-nowrap p-1 font-mono">{String(r.created_at ?? "").slice(5, 19).replace("T", " ")}</td>
                    <td className="p-1">{String(r.actor ?? r.source ?? "")}</td>
                    <td className="p-1 font-medium">{String(r.action ?? r.event_type ?? "")}</td>
                    <td className="p-1 font-mono">{String(r.entity ?? "")}{r.entity_id ? ` ${String(r.entity_id).slice(-6)}` : ""}</td>
                    <td className="max-w-xs truncate p-1 opacity-80">{summaryOf(r)}</td>
                    <td className="p-1">{String((r.details as Record<string, unknown> | undefined)?.decision ?? (r.details as Record<string, unknown> | undefined)?.result ?? (r as Record<string, unknown>).status ?? "—")}</td>
                    <td className="p-1"><button onClick={() => setOpen(open === id ? null : id)} className="underline" aria-label={`JSON for ${id}`}>{open === id ? "Hide" : "JSON"}</button></td>
                  </tr>
                  {open === id && (
                    <tr key={`${id}-json`}>
                      <td colSpan={7} className="bg-black/40 p-2">
                        <pre className="max-h-64 overflow-auto rounded-lg p-2 font-mono text-[11px] leading-relaxed text-emerald-100">{JSON.stringify(r, null, 1)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="p-3 text-sm opacity-60">No rows match. Clear the search or pick another actor.</p>}
      {pages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-sm">
          <GlassButton disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Prev</GlassButton>
          <span className="opacity-70">Page {page + 1} of {pages}</span>
          <GlassButton disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next →</GlassButton>
        </div>
      )}
    </GlassCard>
  );
}

export default function Audit() {
  const [d, setD] = useState<AuditData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");

  function load() {
    api
      .audit()
      .then((r) => {
        setD(r);
        setStatus(r.audit_logs.length + r.system_events.length + r.agent_runs.length > 0 ? "ready" : "empty");
      })
      .catch((e: unknown) => {
        setMsg(errMsg(e));
        setStatus("error");
      });
  }
  useEffect(() => {
    let alive = true;
    api
      .audit()
      .then((r) => {
        if (!alive) return;
        setD(r);
        setStatus(r.audit_logs.length + r.system_events.length + r.agent_runs.length > 0 ? "ready" : "empty");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setMsg(errMsg(e));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") return <Skeleton className="h-60" />;
  if (status === "error") return <ErrorPanel message={msg} onRetry={load} />;
  if (status === "empty" || !d) return <EmptyPanel title="No audit trail yet" body="Run the agents or review proposals — every decision and system event is recorded here." />;
  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">Audit logs · agent runs · system events</h1>
        <div className="ml-auto flex gap-2 text-sm">
          {(["recommendations", "scenarios", "audit"] as const).map((k) => <a key={k} className="btn btn-secondary px-3 py-1.5" href={`${API_BASE}/api/export/csv?kind=${k}`}>CSV: {k}</a>)}
        </div>
      </GlassCard>
      <LogTable title="Planner/system audit" rows={d.audit_logs} />
      <LogTable title="Agent executions" rows={d.agent_runs as unknown as AuditRow[]} />
      <LogTable title="POS/WMS/ERP (simulated)" rows={d.system_events} />
    </div>
  );
}
