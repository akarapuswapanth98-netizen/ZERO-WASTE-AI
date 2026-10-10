"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorPanel, GlassButton, GlassCard, Skeleton, Toasts, type Toast } from "@/components/glass";
import { api, type ReplayOut } from "@/lib/api";
import { errMsg, type AgentRun, type AuditData, type Status } from "@/lib/types";

const AGENTS: Array<[string, string, string]> = [
  ["demand_forecasting", "Demand Forecaster", "Predicts units/day from sales history"],
  ["spoilage_risk", "Spoilage Estimator", "FIFO burn-down against forecast → risk band"],
  ["inventory_analysis", "Stock Analyst", "Finds excess, shortages, transfer pairs"],
  ["action_recommendation", "Options Pricer", "Scores markdown/donate/transfer/replenish/no-action"],
  ["coordinator", "Coordinator", "Validates, enforces rules, picks one proposal"],
];
const friendly = (a: string) => AGENTS.find(([id]) => id === a)?.[1] ?? a;

interface RunDetail { inputs: unknown; outputs: unknown; }

function NodeInspector({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [d, setD] = useState<RunDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    api
      .runDetail(runId)
      .then((r) => {
        if (alive) setD(r);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [runId]);
  return (
    <div className="mt-2 rounded-xl bg-black/30 p-3">
      <div className="flex items-center gap-2">
        <p className="font-mono text-xs">{runId}</p>
        <button onClick={onClose} className="ml-auto text-xs underline">Close</button>
      </div>
      {failed && <p className="text-sm text-red-500">Run detail failed to load.</p>}
      {!d && !failed && <Skeleton className="h-24" />}
      {d && (
        <div className="grid gap-2 md:grid-cols-2">
          {(["inputs", "outputs"] as const).map((k) => (
            <div key={k}>
              <p className="mt-1 text-xs font-bold uppercase opacity-60">{k}</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-emerald-100">{JSON.stringify(d[k], null, 1)?.slice(0, 4000)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [busyRun, setBusyRun] = useState(false);
  const [busyReplay, setBusyReplay] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [diff, setDiff] = useState<ReplayOut | null>(null);
  const [selRun, setSelRun] = useState<string | null>(null);
  const toastId = useRef(0);

  function pushToast(kind: "ok" | "err", text: string) {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }
  function load() {
    api
      .audit()
      .then((a) => {
        setAudit(a);
        setStatus("ready");
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
      .then((a) => {
        if (!alive) return;
        setAudit(a);
        setStatus("ready");
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

  async function runAll() {
    setBusyRun(true);
    try {
      const r = await api.runAgents({});
      pushToast("ok", `${r.count} agent proposals stored ✓`);
      load();
    } catch (e: unknown) {
      pushToast("err", `Run failed: ${errMsg(e)}`);
    } finally {
      setBusyRun(false);
    }
  }
  async function replay() {
    setBusyReplay(true);
    try {
      const r = await api.replay({ low_thr: 0.05, high_thr: 0.2 });
      setDiff(r);
      pushToast("ok", `Replayed with 5%/20% thresholds: ${r.diff_count} changed ✓`);
    } catch (e: unknown) {
      pushToast("err", `Replay failed: ${errMsg(e)}`);
    } finally {
      setBusyReplay(false);
    }
  }

  const groups = useMemo(() => {
    const m = new Map<string, AgentRun[]>();
    (audit?.agent_runs ?? []).forEach((r) => {
      const k = `${r.store_id ?? "?"}|${r.sku ?? "?"}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)?.push(r);
    });
    return [...m.entries()].slice(0, 12);
  }, [audit]);

  const counts = useMemo(() => {
    const m = new Map((audit?.agent_counts ?? []).map((c) => [c.agent_name, c.n]));
    return m;
  }, [audit]);

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-xl font-extrabold">AI Agent Control Center</h1>
          <p className="text-xs opacity-60">Deterministic engine · Gemini only explains · every run stored as JSON for replay.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <GlassButton variant="primary" loading={busyRun} onClick={() => void runAll()}>
            {busyRun ? <span className="flex items-center gap-2"><span className="pulse-dot">●</span> Running…</span> : "Run all agents"}
          </GlassButton>
          <GlassButton loading={busyReplay} onClick={() => void replay()}>
            {busyReplay ? <span className="flex items-center gap-2"><span className="pulse-dot">●</span> Replaying…</span> : "Counterfactual replay (5%/20%)"}
          </GlassButton>
        </div>
      </GlassCard>
      <Toasts toasts={toasts} />
      {diff && (
        <GlassCard className="text-sm">
          <h2 className="font-bold">Replay diff ({diff.diff_count} changed proposals)</h2>
          {diff.diffs.length === 0 && <p className="opacity-60">No proposal changed under the new thresholds.</p>}
          <ul className="list-disc pl-5">{diff.diffs.map((x, i) => <li key={i}>{x.store_id} {x.sku}: {x.before} → {x.after}</li>)}</ul>
        </GlassCard>
      )}
      {status === "loading" && <Skeleton className="h-40" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={load} />}
      {status === "ready" && audit && (
        <>
          <GlassCard>
            <h2 className="font-bold">Pipeline (click a node for its latest structured input/output)</h2>
            <div className="mt-3 flex flex-col items-stretch gap-1 md:flex-row md:items-center" role="list" aria-label="Agent pipeline">
              {AGENTS.map(([id, name, blurb], i) => {
                const latest = audit.agent_runs.find((r) => r.agent_name === id);
                return (
                  <div key={id} role="listitem" className="flex flex-1 flex-col md:flex-row md:items-center">
                    <button
                      onClick={() => setSelRun(latest && selRun !== latest.run_id ? latest.run_id : null)}
                      disabled={!latest}
                      className={`glass flex-1 p-3 text-left transition hover:shadow-[0_0_18px_rgba(16,185,129,0.35)] disabled:opacity-50 ${selRun && latest?.run_id === selRun ? "ring-2 ring-emerald-400" : ""}`}
                      aria-label={`${name}: ${blurb}`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider opacity-60">Step {i + 1}</p>
                      <p className="font-bold">{name}</p>
                      <p className="text-xs opacity-60">{blurb}</p>
                      <p className="mt-1 font-mono text-[11px] opacity-70">{latest ? `${latest.status} · ${latest.duration_ms}ms · ${counts.get(id) ?? 0} runs` : "not run yet"}</p>
                    </button>
                    {i < AGENTS.length - 1 && (
                      <svg width="34" height="20" viewBox="0 0 34 20" className="flow-edge mx-auto shrink-0 rotate-90 md:rotate-0" aria-hidden>
                        <line x1="2" y1="10" x2="26" y2="10" stroke="#66E3A1" strokeWidth="2" strokeDasharray="5 4" />
                        <polygon points="26,5 34,10 26,15" fill="#66E3A1" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            {selRun && <NodeInspector runId={selRun} onClose={() => setSelRun(null)} />}
          </GlassCard>
          <GlassCard>
            <h2 className="font-bold">Latest traces by store × SKU (click any run for JSON)</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {groups.map(([k, runs]) => (
                <div key={k} className="rounded-xl bg-black/20 p-2">
                  <p className="font-mono text-xs font-bold">{k}</p>
                  <ol className="mt-1 space-y-0.5">
                    {runs.slice(0, 6).map((r) => (
                      <li key={r.run_id}>
                        <button onClick={() => setSelRun(selRun === r.run_id ? null : r.run_id)} className="flex w-full gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-white/10">
                          <span className="rounded bg-white/10 px-1.5">{friendly(r.agent_name)}</span>
                          <span className="ml-auto opacity-60">{r.status} · {r.duration_ms}ms</span>
                        </button>
                        {selRun === r.run_id && <NodeInspector runId={r.run_id} onClose={() => setSelRun(null)} />}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
      <style>{`.flow-edge line{animation:dashmove 1.1s linear infinite}@keyframes dashmove{to{stroke-dashoffset:-9}}`}</style>
    </div>
  );
}
