"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, EmptyPanel, ErrorPanel, GlassCard, Skeleton } from "@/components/glass";
import { API_BASE, api } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { errMsg, type EvaluationData, type ScenarioRow, type Status } from "@/lib/types";

const EXPORTS = ["recommendations", "scenarios", "audit"] as const;
const METRICS: Array<{ key: string; label: string; better: "low" | "high"; money?: boolean }> = [
  { key: "waste_units", label: "Waste (units)", better: "low" },
  { key: "stockout_units", label: "Stockouts", better: "low" },
  { key: "service_level", label: "Service", better: "high" },
  { key: "total_cost", label: "Total cost ($)", better: "low", money: true },
  { key: "net_margin", label: "Net margin ($)", better: "high", money: true },
  { key: "revenue", label: "Revenue ($)", better: "high", money: true },
];

function materialWin(a: number, others: number[], better: "low" | "high", absFloor: number): boolean {
  if (better === "low") {
    const best = Math.min(...others);
    return a < best && best - a >= Math.max(absFloor, 0.02 * Math.abs(best));
  }
  const best = Math.max(...others);
  return a > best && a - best >= Math.max(absFloor, 0.02 * Math.abs(best));
}

function MiniMetric({ title, rows, money }: {
  title: string; rows: Array<{ policy: string; mean: number; min: number; max: number }>; money?: boolean;
}) {
  const data = rows.map((r) => ({ name: r.policy, mean: r.mean, range: [r.min, r.max] }));
  const fmt = (v: number) => (money ? fmtMoney(v, 0) : v.toLocaleString());
  return (
    <div className="rounded-xl bg-black/20 p-2">
      <p className="text-xs font-bold">{title}</p>
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" fontSize={10} stroke="currentColor" opacity={0.6} />
          <YAxis type="category" dataKey="name" fontSize={10} width={86} stroke="currentColor" opacity={0.8} />
          <Tooltip formatter={(v) => (typeof v === "number" ? fmt(v) : v)} />
          <Bar dataKey="mean" fill="#66E3A1" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            <ErrorBar dataKey="range" width={5} strokeWidth={2} stroke="#e8f0ea" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function latestPerPreset(rows: ScenarioRow[]): Map<string, ScenarioRow[]> {
  const byPreset = new Map<string, ScenarioRow[]>();
  rows.forEach((r) => {
    if (!byPreset.has(r.scenario_name)) byPreset.set(r.scenario_name, []);
    byPreset.get(r.scenario_name)?.push(r);
  });
  const out = new Map<string, ScenarioRow[]>();
  byPreset.forEach((list, preset) => {
    const latest: ScenarioRow[] = [];
    ["agentic", "fifo", "fixed-threshold"].forEach((pol) => {
      const cand = list.filter((r) => r.policy === pol).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (cand) latest.push(cand);
    });
    if (latest.length > 0) out.set(preset, latest);
  });
  return out;
}

export default function Evaluation() {
  const [d, setD] = useState<EvaluationData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [preset, setPreset] = useState("");

  function load() {
    api
      .evaluation()
      .then((r) => {
        setD(r);
        setStatus("ready");
        const names = [...new Set(r.scenario_runs.map((x) => x.scenario_name))];
        if (names.length > 0) setPreset((cur) => (names.includes(cur) ? cur : names[0]));
      })
      .catch((e: unknown) => {
        setMsg(errMsg(e));
        setStatus("error");
      });
  }
  useEffect(() => {
    let alive = true;
    api
      .evaluation()
      .then((r) => {
        if (!alive) return;
        setD(r);
        setStatus("ready");
        const names = [...new Set(r.scenario_runs.map((x) => x.scenario_name))];
        if (names.length > 0) setPreset(names[0]);
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

  const matrix = useMemo(() => (d ? latestPerPreset(d.scenario_runs) : new Map<string, ScenarioRow[]>()), [d]);
  const presets = useMemo(() => [...matrix.keys()], [matrix]);
  const sel = useMemo(() => matrix.get(preset) ?? [], [matrix, preset]);
  const byPol = useMemo(() => {
    const m = new Map<string, ScenarioRow>();
    sel.forEach((r) => m.set(r.policy, r));
    return m;
  }, [sel]);

  const verdicts = useMemo(() => {
    const pols = ["agentic", "fifo", "fixed-threshold"];
    return METRICS.map((m) => {
      const vals = pols.map((p) => byPol.get(p)?.metrics[m.key]?.mean ?? NaN);
      if (vals.some((v) => Number.isNaN(v))) return { ...m, winner: "—", detail: "missing data" };
      const order = m.better === "low" ? [...vals].sort((a, b) => a - b) : [...vals].sort((a, b) => b - a);
      const winIdx = m.better === "low" ? vals.indexOf(order[0]) : vals.indexOf(order[0]);
      const winPol = pols[winIdx];
      const wins = materialWin(order[0], order.slice(1), m.better, m.key === "service_level" ? 0.02 : 10);
      const fmt = (v: number) => (m.money ? fmtMoney(v, 0) : v.toLocaleString());
      return {
        ...m,
        winner: wins ? winPol : "tie",
        detail: `${pols.map((p, i) => `${p} ${fmt(vals[i])}`).join(" · ")}${wins ? ` → ${winPol} wins` : " → no material winner"}`,
      };
    });
  }, [byPol]);

  const agVsBoth = useMemo(() => {
    const beats = verdicts.filter((v) => v.winner === "agentic").map((v) => v.label);
    const loses = verdicts.filter((v) => v.winner !== "agentic" && v.winner !== "tie").map((v) => `${v.label} (${v.winner})`);
    return { beats, loses };
  }, [verdicts]);

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">Evaluation & Audit</h1>
        <div className="ml-auto flex gap-2 text-sm">
          {EXPORTS.map((k) => <a key={k} className="btn btn-secondary px-3 py-1.5" href={`${API_BASE}/api/export/csv?kind=${k}`}>CSV: {k}</a>)}
        </div>
      </GlassCard>
      {status === "loading" && <Skeleton className="h-40" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={load} />}
      {status === "ready" && d && (
        <>
          <GlassCard className="text-sm">
            <h2 className="font-bold">Methodology & assumptions</h2>
            <p className="opacity-80">{d.methodology}</p>
            <p className="opacity-80">{d.assumptions}</p>
            <p className="mt-1">Measurement: 14-day simulated horizon per scenario run; units = inventory units / USD; runtime = server compute ms (excluded from reproducibility checks).</p>
            <p className="mt-1">Planner decisions: {d.decisions.length > 0 ? d.decisions.map((x) => `${x.decision}×${x.n}`).join(", ") : "none yet"} · Recommendations: {d.recommendation_status.length > 0 ? d.recommendation_status.map((x) => `${x.status}×${x.n}`).join(", ") : "none yet"}</p>
          </GlassCard>

          {presets.length === 0 && <EmptyPanel title="No scenario runs stored" body="Run a comparison from Scenarios — the matrix builds itself from stored runs." />}
          {presets.length > 0 && (
            <>
              <GlassCard>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">Policy matrix (latest stored run per preset)</h2>
                  <div className="ml-auto flex flex-wrap gap-1">
                    {presets.map((p) => (
                      <button key={p} onClick={() => setPreset(p)} className={`rounded-full px-3 py-1 text-xs ${preset === p ? "bg-emerald-500/30 font-bold" : "bg-white/10"}`} aria-pressed={preset === p}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm">
                  Headline vs both baselines: agentic leads on <b>{agVsBoth.beats.length > 0 ? agVsBoth.beats.join(", ") : "nothing material"}</b>
                  {agVsBoth.loses.length > 0 && <span>; trails on <b>{agVsBoth.loses.join(", ")}</b></span>}.
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {(["waste_units", "stockout_units", "service_level", "net_margin", "revenue"] as const).map((k) => (
                    <MiniMetric
                      key={k}
                      title={METRICS.find((m) => m.key === k)?.label ?? k}
                      money={k === "net_margin" || k === "revenue"}
                      rows={["agentic", "fifo", "fixed-threshold"].map((p) => ({
                        policy: p,
                        mean: byPol.get(p)?.metrics[k]?.mean ?? 0,
                        min: byPol.get(p)?.metrics[k]?.min ?? 0,
                        max: byPol.get(p)?.metrics[k]?.max ?? 0,
                      }))}
                    />
                  ))}
                </div>
                <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                  {verdicts.map((v) => (
                    <li key={v.key}>{v.label}: {v.detail} {v.winner !== "tie" && <Chip tone={v.winner === "agentic" ? "low" : "med"}>{v.winner}</Chip>}</li>
                  ))}
                </ul>
              </GlassCard>

              <GlassCard className="overflow-auto text-sm">
                <h2 className="mb-2 font-bold">All presets × policies (mean [min–max])</h2>
                <table className="w-full">
                  <thead><tr className="text-left text-xs uppercase opacity-50"><th>Preset</th><th>Policy</th><th>Waste</th><th>Stockout</th><th>Service</th><th>Net margin</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {[...matrix.entries()].flatMap(([p, rows]) =>
                      rows.map((r) => (
                        <tr key={`${p}-${r.policy}`} className="border-t border-white/10">
                          <td className="py-1 font-bold">{p}</td><td>{r.policy}</td>
                          <td>{r.metrics.waste_units?.mean}[{r.metrics.waste_units?.min}–{r.metrics.waste_units?.max}]</td>
                          <td>{r.metrics.stockout_units?.mean}</td><td>{r.metrics.service_level?.mean}</td>
                          <td>{r.metrics.net_margin ? fmtMoney(r.metrics.net_margin.mean, 0) : "—"}</td>
                          <td>${r.metrics.revenue?.mean}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </GlassCard>
            </>
          )}

          {d.latest_comparison ? (
            <GlassCard className="text-sm">
              <h2 className="font-bold">Latest full comparison: {d.latest_comparison.preset} (base seed {d.latest_comparison.seed}, {d.latest_comparison.seeds} seeds)</h2>
              <div className="mt-2 overflow-auto">
                <table className="w-full">
                  <thead><tr className="text-left text-xs uppercase opacity-50"><th>Policy</th><th>Waste (units)</th><th>Stockouts</th><th>Service</th><th>Total cost</th><th>Net margin</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {Object.entries(d.latest_comparison.policies).map(([k, v]) => (
                      <tr key={k} className="border-t border-white/10">
                        <td className="py-1 font-bold">{k}</td>
                        <td>{v.waste_units.mean} (${v.waste_cost.mean})</td>
                        <td>{v.stockout_units.mean}</td>
                        <td>{v.service_level.mean}</td>
                        <td>${v.total_cost.mean}</td>
                        <td>{fmtMoney(v.net_margin.mean, 0)}</td>
                        <td>${v.revenue.mean}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2">
                {d.latest_comparison.waste_reduction_pct === null ? "Waste reduction: n/a (baseline waste ~ 0). " : `Waste reduction (agentic vs FIFO): ${d.latest_comparison.waste_reduction_pct}%. `}
                <span className="opacity-70">{d.latest_comparison.waste_reduction_note}</span>
              </p>
              <p className="mt-2 rounded bg-white/5 p-3 opacity-90">{d.latest_comparison.trade_off_note}</p>
            </GlassCard>
          ) : (
            <GlassCard><p className="text-sm opacity-60">No scenario comparison stored yet — run one from Scenarios.</p></GlassCard>
          )}
          <GlassCard className="overflow-auto text-sm">
            <h2 className="mb-2 font-bold">Scenario history (latest)</h2>
            <table className="w-full">
              <thead><tr className="text-left text-xs uppercase opacity-50"><th>When</th><th>Preset</th><th>Policy</th><th>Waste (mean)</th></tr></thead>
              <tbody>
                {d.scenario_runs.slice(0, 20).map((s) => (
                  <tr key={s.scenario_id} className="border-t border-white/10">
                    <td>{(s.created_at ?? "").slice(0, 19)}</td><td>{s.scenario_name}</td><td>{s.policy}</td>
                    <td>{s.metrics?.waste_units ? `${s.metrics.waste_units.mean} units · net ${fmtMoney(s.metrics.net_margin?.mean ?? 0, 0)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </>
      )}
    </div>
  );
}
