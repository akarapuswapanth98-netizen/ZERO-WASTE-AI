"use client";
import { useEffect, useMemo, useState } from "react";
import { ErrorPanel, GlassButton, GlassCard, RiskChip, Skeleton } from "@/components/glass";
import { api } from "@/lib/api";
import { errMsg, type Product, type RiskData, type Status, type Store } from "@/lib/types";

interface Row {
  sku: string; name: string; risk: RiskData | null; failed: boolean;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default function RiskPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [store, setStore] = useState("store_001");
  const [low, setLow] = useState(0.1);
  const [high, setHigh] = useState(0.3);
  const [applied, setApplied] = useState({ low: 0.1, high: 0.3 });
  const [rows, setRows] = useState<Row[]>([]);
  const [sort, setSort] = useState<"ratio" | "expiry" | "sku">("ratio");
  const [sel, setSel] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.stores(), api.products()])
      .then(([s, p]) => {
        if (!alive) return;
        setStores(s.stores);
        setProds(p.products);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (prods.length === 0) return;
    let alive = true;
    Promise.all(
      prods.map((p) =>
        api
          .risk(store, p.sku, applied.low, applied.high)
          .then((r) => ({ sku: p.sku, name: p.name, risk: r, failed: false })),
      ),
    )
      .then((rs) => {
        if (!alive) return;
        setRows(rs);
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
  }, [store, prods, applied]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sort === "sku") arr.sort((a, b) => a.sku.localeCompare(b.sku));
    else if (sort === "expiry") arr.sort((a, b) => (a.risk?.days_to_first_expiry ?? 999) - (b.risk?.days_to_first_expiry ?? 999));
    else arr.sort((a, b) => (b.risk?.risk_ratio ?? -1) - (a.risk?.risk_ratio ?? -1));
    return arr;
  }, [rows, sort]);

  const detail = sel ? rows.find((r) => r.sku === sel)?.risk ?? null : null;
  const crossHigh = detail && detail.risk_range[1] >= (detail.thresholds?.high ?? 0.3);
  const crossLabel =
    detail?.band === "Medium" && crossHigh ? "Medium (could reach High)" :
    detail?.band === "Low" && crossHigh ? "Low (could reach High)" : null;

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">Spoilage Risk Center</h1>
        <select value={store} onChange={(e) => setStore(e.target.value)} className="glass-input ml-auto" aria-label="Store">
          {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_id} · {s.name}</option>)}
        </select>
        <label className="text-sm">Low &lt;<input type="number" step={1} min={0} max={100} value={Math.round(low * 100)} onChange={(e) => setLow(Number(e.target.value) / 100)} className="glass-input ml-1 w-20" aria-label="Low threshold percent" />%</label>
        <label className="text-sm">High ≥<input type="number" step={1} min={0} max={100} value={Math.round(high * 100)} onChange={(e) => setHigh(Number(e.target.value))} className="glass-input ml-1 w-20" aria-label="High threshold percent" />%</label>
        <GlassButton variant="primary" onClick={() => setApplied({ low, high })}>Re-run assessment</GlassButton>
      </GlassCard>
      <p className="text-xs opacity-60">Thresholds: Low &lt;{pct(applied.low)} · Medium {pct(applied.low)}–{pct(applied.high)} · High ≥{pct(applied.high)}. First column colour = band; cell value = risk ratio with range.</p>
      {status === "loading" && <Skeleton className="h-60" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={() => setApplied({ low, high })} />}
      {status === "ready" && (
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <GlassCard className="overflow-auto !p-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase opacity-50">
                  <th className="p-2"><button onClick={() => setSort("sku")} className="underline">SKU {sort === "sku" ? "↓" : ""}</button></th>
                  <th className="p-2">Band</th>
                  <th className="p-2"><button onClick={() => setSort("ratio")} className="underline">Risk {sort === "ratio" ? "↓" : ""}</button></th>
                  <th className="p-2">Range</th>
                  <th className="p-2"><button onClick={() => setSort("expiry")} className="underline">Expiry {sort === "expiry" ? "↓" : ""}</button></th>
                  <th className="p-2">On hand</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.sku} onClick={() => setSel(r.sku)} className={`cursor-pointer border-t border-white/10 hover:bg-emerald-500/10 ${sel === r.sku ? "bg-emerald-500/10" : ""}`}>
                    <td className="p-2 font-medium">{r.sku}<br /><span className="text-xs opacity-60">{r.name}</span></td>
                    <td className="p-2">{r.risk ? <RiskChip band={r.risk.band} /> : r.failed ? <span className="text-red-500">failed</span> : <span className="opacity-50">…</span>}</td>
                    <td className="p-2 font-bold">{r.risk ? pct(r.risk.risk_ratio) : "—"}</td>
                    <td className="p-2 text-xs opacity-70">{r.risk ? `${pct(r.risk.risk_range[0])}–${pct(r.risk.risk_range[1])}` : "—"}</td>
                    <td className="p-2">{r.risk ? `${r.risk.days_to_first_expiry}d` : "—"}</td>
                    <td className="p-2">{r.risk ? r.risk.on_hand : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
          <GlassCard className="text-sm">
            {!sel && <p className="opacity-60">Click a row for the full classification, range and reasoning.</p>}
            {sel && !detail && <p className="opacity-60">Loading {sel}…</p>}
            {sel && detail && (
              <div className="space-y-2">
                <h2 className="font-bold">{sel}</h2>
                <p className="text-lg"><RiskChip band={detail.band} />{crossLabel && <span className="ml-2 text-xs opacity-70">{crossLabel}</span>}</p>
                <p>Ratio <b>{pct(detail.risk_ratio)}</b> · range {pct(detail.risk_range[0])}–{pct(detail.risk_range[1])} · thresholds {pct(detail.thresholds.low)}/{pct(detail.thresholds.high)}</p>
                <p>{detail.reason}</p>
                <p className="text-xs opacity-60">At-risk {detail.at_risk_mean}u of {detail.on_hand}u (low-demand case {detail.at_risk_low_demand}u, high-demand {detail.at_risk_high_demand}u). {detail.disclaimer}</p>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
