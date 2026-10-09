"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, EmptyPanel, ErrorPanel, GlassButton, GlassCard, Skeleton } from "@/components/glass";
import { api, type CalibrationOut } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { errMsg, type ScenarioOut, type Status } from "@/lib/types";

const PRESETS = ["baseline", "demand_spike", "supplier_delay", "short_shelf", "promo_markdown", "excess_inventory", "store_variance"];
const DEFAULTS: Record<string, { mult: string; days: string; cut: string; block: string }> = {
  baseline: { mult: "1.0", days: "7", cut: "0", block: "0" },
  demand_spike: { mult: "1.5", days: "7", cut: "0", block: "0" },
  supplier_delay: { mult: "1.0", days: "7", cut: "0", block: "5" },
  short_shelf: { mult: "1.0", days: "7", cut: "2", block: "0" },
  promo_markdown: { mult: "1.35", days: "7", cut: "0", block: "0" },
  excess_inventory: { mult: "1.0", days: "7", cut: "0", block: "0" },
  store_variance: { mult: "1.0", days: "7", cut: "0", block: "0" },
};

interface Params { mult: string; days: string; cut: string; block: string; }

export default function Scenarios() {
  const [preset, setPreset] = useState("demand_spike");
  const [seeds, setSeeds] = useState(5);
  const [params, setParams] = useState<Params>(DEFAULTS.demand_spike);
  const [out, setOut] = useState<ScenarioOut | null>(null);
  const [ranPreset, setRanPreset] = useState("");
  const [status, setStatus] = useState<Status>("empty");
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [cal, setCal] = useState<CalibrationOut | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .calibration()
      .then((c) => {
        if (alive) setCal(c);
      })
      .catch(() => undefined);
    api
      .evaluation()
      .then((ev) => {
        if (!alive) return;
        const lc = ev.latest_comparison;
        if (lc) {
          // latest stored run renders immediately; a fresh run replaces it
          setPreset(lc.preset);
          setOut({
            preset: lc.preset,
            params: {},
            policies: lc.policies as ScenarioOut["policies"],
            waste_reduction_pct: lc.waste_reduction_pct,
            waste_reduction_note: lc.waste_reduction_note,
            seeds_run: lc.seeds,
            seeds_capped: false,
          });
          setRanPreset(lc.preset);
          setStatus("ready");
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  function pickPreset(p: string) {
    setPreset(p);
    setParams(DEFAULTS[p] ?? DEFAULTS.baseline);
  }

  function bodyFor(): Record<string, unknown> {
    // knobs flow into the run as overrides; identical inputs still reach all policies
    const num = (s: string, fb: number) => {
      const v = Number(s);
      return Number.isFinite(v) ? v : fb;
    };
    const d = DEFAULTS[preset] ?? DEFAULTS.baseline;
    return {
      preset,
      seeds,
      base_seed: 42,
      overrides: {
        demand_mult: num(params.mult, Number(d.mult)),
        days: Math.max(0, Math.round(num(params.days, Number(d.days)))),
        expiry_shift: -Math.max(0, Math.round(num(params.cut, Number(d.cut)))),
        block_replenish_days: Math.max(0, Math.round(num(params.block, Number(d.block)))),
      },
    };
  }

  async function run() {
    setStatus("loading");
    setProgress(`Starting ${preset}…`);
    try {
      // per-preset knobs are documented below; the engine presets stay canonical so runs stay comparable
      const r = await api.scenario(bodyFor());
      setOut(r);
      setRanPreset(r.preset);
      setStatus("ready");
      setProgress("");
    } catch (e: unknown) {
      setMsg(errMsg(e));
      setStatus("error");
      setProgress("");
    }
  }

  const chart = out
    ? ["waste_units", "stockout_units", "revenue", "net_margin"].map((k) => ({
        metric: k,
        agentic: out.policies.agentic[k].mean,
        fifo: out.policies.fifo[k].mean,
        fixed: out.policies["fixed-threshold"][k].mean,
      }))
    : [];
  const negCost = out && Object.values(out.policies).some((p) => p.total_cost.mean < 0);

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-xl font-extrabold">Scenario Simulator</h1>
          <p className="text-xs opacity-60">Identical demand/inventory/seeds for all policies · mean + min–max over seeds. Unfavourable outcomes shown honestly.</p>
        </div>
        <select value={preset} onChange={(e) => pickPreset(e.target.value)} className="glass-input ml-auto" aria-label="Scenario preset">
          {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="text-sm">Seeds <input type="number" min={2} max={20} value={seeds} onChange={(e) => setSeeds(Number(e.target.value))} className="glass-input w-16" aria-label="Seed count" /></label>
        <GlassButton variant="primary" onClick={() => void run()}>Run comparison</GlassButton>
      </GlassCard>

      <GlassCard className="!p-3 text-sm">
        <h2 className="font-bold">Preset knobs (what each preset changes)</h2>
        <div className="mt-1 grid gap-2 text-xs opacity-80 md:grid-cols-4">
          <label>Demand × <input value={params.mult} onChange={(e) => setParams({ ...params, mult: e.target.value })} inputMode="decimal" className="glass-input ml-1 w-16" aria-label="Demand multiplier" /></label>
          <label>Shock days <input value={params.days} onChange={(e) => setParams({ ...params, days: e.target.value })} inputMode="numeric" className="glass-input ml-1 w-14" aria-label="Shock days" /></label>
          <label>Shelf-life cut (days) <input value={params.cut} onChange={(e) => setParams({ ...params, cut: e.target.value })} inputMode="numeric" className="glass-input ml-1 w-14" aria-label="Shelf life cut" /></label>
          <label>Replenish blocked (days) <input value={params.block} onChange={(e) => setParams({ ...params, block: e.target.value })} inputMode="numeric" className="glass-input ml-1 w-14" aria-label="Blocked days" /></label>
        </div>
        <p className="mt-1 text-xs opacity-60">Knobs override the preset for this run only; the same overridden inputs reach agentic, FIFO and fixed-threshold, so comparisons stay fair. Excess inventory (3.5× stock) and store variance use fixed definitions.</p>
      </GlassCard>

      {progress && <p role="status" className="glass animate-pulse p-3 text-sm">{progress} Simulating 3 policies × {seeds} seeds with rolling-horizon agentic planning…</p>}
      {status === "loading" && !progress && <Skeleton className="h-60" />}
      {status === "loading" && <Skeleton className="h-40" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={() => void run()} />}
      {status === "empty" && (
        <EmptyPanel
          title={ranPreset ? `Last stored run: ${ranPreset} (see Evaluation)` : "No scenario run yet"}
          body="Pick a preset and run the 3-policy comparison. Baseline = no shock; excess_inventory starts 3.5× stock."
        />
      )}
      {status === "ready" && out && (
        <>
          <GlassCard>
            {out.waste_reduction_pct === null ? (
              <p className="text-sm">Waste reduction: <Chip tone="plain">n/a (baseline waste ~ 0)</Chip> <span className="opacity-70">{out.waste_reduction_note}</span></p>
            ) : (
              <p className="text-sm">Waste reduction (agentic vs FIFO): <b>{out.waste_reduction_pct}%</b> <span className="opacity-70">· {out.waste_reduction_note}</span>
                {out.waste_reduction_pct < 0 && <span className="ml-2"><Chip tone="high">unfavourable — shown honestly</Chip></span>}</p>
            )}
            <p className="mt-1 text-xs opacity-60">Params {JSON.stringify(out.params)} · seeds run: {out.seeds_run ?? seeds}{out.seeds_capped ? " (capped at 5 in production)" : ""} · donated units (agentic): {out.policies.agentic.donated_units?.mean ?? 0} · recovery {fmtMoney(out.policies.agentic.donation_recovery?.mean ?? 0)} · markdown cost: {fmtMoney(out.policies.agentic.markdown_cost?.mean ?? 0)}</p>
            {negCost && <p className="mt-1 text-xs">Note: a negative total cost means donation recovery exceeded fees + waste + markdown (shown as -$, never $-).</p>}
          </GlassCard>
          <GlassCard>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <XAxis dataKey="metric" fontSize={12} stroke="currentColor" opacity={0.6} />
                <YAxis fontSize={12} stroke="currentColor" opacity={0.6} />
                <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString() : v)} /><Legend />
                <Bar dataKey="agentic" fill="#10B981" isAnimationActive={false} />
                <Bar dataKey="fifo" fill="#94a3b8" isAnimationActive={false} />
                <Bar dataKey="fixed" fill="#d97706" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
          <GlassCard className="overflow-auto text-sm">
            <table className="w-full">
              <thead><tr className="text-left text-xs uppercase opacity-50"><th>Policy</th><th>Waste u (mean[min–max])</th><th>Stockout</th><th>Revenue</th><th>Service</th><th>Total cost</th><th>Net margin</th><th>Runtime</th></tr></thead>
              <tbody>
                {Object.entries(out.policies).map(([k, v]) => (
                  <tr key={k} className="border-t border-white/10">
                    <td className="py-1 font-bold">{k}</td>
                    <td>{v.waste_units.mean}[{v.waste_units.min}–{v.waste_units.max}] ({fmtMoney(v.waste_cost.mean)})</td>
                    <td>{v.stockout_units.mean}</td><td>{fmtMoney(v.revenue.mean, 0)}</td>
                    <td>{v.service_level.mean}</td><td>{fmtMoney(v.total_cost.mean)}</td><td>{fmtMoney(v.net_margin.mean, 0)}</td><td>{v.runtime_ms.mean}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs opacity-60">Net margin = gross revenue − COGS − waste cost − markdown give-away − ordering fees. Full formulas on Evaluation.</p>
          </GlassCard>
        </>
      )}

      <GlassCard className="text-sm">
        <h2 className="font-bold">Calibration: starting cover vs 14-day horizon (as of {cal?.asof ?? "…"})</h2>
        {!cal && <p className="opacity-60">Loading calibration…</p>}
        {cal && (
          <>
            <p className="mt-1 opacity-70">{cal.note}</p>
            <div className="mt-2 overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left uppercase opacity-50"><th>SKU (shelf)</th>{["store_001", "store_002", "store_003", "store_004", "store_005"].map((s) => <th key={s}>{s.slice(-3)}</th>)}</tr></thead>
                <tbody>
                  {[...new Map(cal.cover.map((c) => [c.sku, c.shelf_life_days])).entries()].map(([sku, shelf]) => (
                    <tr key={sku} className="border-t border-white/10">
                      <td className="py-0.5 font-mono">{sku} ({shelf}d)</td>
                      {["store_001", "store_002", "store_003", "store_004", "store_005"].map((s) => {
                        const cell = cal.cover.find((c) => c.sku === sku && c.store_id === s);
                        return <td key={s} className={cell && cell.cover_days < 3 ? "text-red-400" : cell && cell.cover_days < 7 ? "text-amber-300" : ""}>{cell ? `${cell.cover_days}d` : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-3 text-sm font-bold">FIFO outcomes per preset (single seed)</h3>
            <div className="mt-1 overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left uppercase opacity-50"><th>Preset</th><th>Waste (units)</th><th>Stockouts</th><th>Service</th></tr></thead>
                <tbody>
                  {Object.entries(cal.fifo_single_seed).map(([p, f]) => (
                    <tr key={p} className="border-t border-white/10">
                      <td className="py-0.5 font-mono">{p}</td><td>{f.waste_units.toLocaleString()}</td><td>{f.stockout_units.toLocaleString()}</td><td>{f.service_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] opacity-50">Single-seed snapshot for calibration only; reported comparisons use multi-seed means.</p>
          </>
        )}
      </GlassCard>
    </div>
  );
}
