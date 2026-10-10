"use client";
import { useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, EmptyPanel, ErrorPanel, GlassCard, Skeleton } from "@/components/glass";
import { api } from "@/lib/api";
import { errMsg, type ForecastData, type Product, type Status, type Store } from "@/lib/types";

interface Pt { d: string; actual?: number; fc?: number; lo?: number; hi?: number; sesT?: number; maT?: number; seasT?: number; }

export default function ForecastPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [store, setStore] = useState("store_001");
  const [sku, setSku] = useState("MILK-1L");
  const [horizon, setHorizon] = useState(7);
  const [data, setData] = useState<ForecastData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.stores(), api.products()])
      .then(([s, p]) => {
        if (!alive) return;
        setStores(s.stores);
        setProds(p.products);
        if (s.stores.length > 0) setStore((cur) => (s.stores.some((x) => x.store_id === cur) ? cur : s.stores[0].store_id));
        if (p.products.length > 0) setSku((cur) => (p.products.some((x) => x.sku === cur) ? cur : p.products[0].sku));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .forecast(store, sku, horizon)
      .then((d) => {
        if (!alive) return;
        setData(d);
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
  }, [store, sku, horizon]);

  const chart: Pt[] = data
    ? [
        ...data.history_dates.slice(-28).map((d, i, arr): Pt => {
          const isTest = i >= arr.length - data.test_len;
          const ti = isTest ? i - (arr.length - data.test_len) : -1;
          return {
            d: d.slice(5),
            actual: data.history_values.slice(-28)[i],
            sesT: ti >= 0 ? data.test_models.ses[ti] : undefined,
            maT: ti >= 0 ? data.test_models.ma[ti] : undefined,
            seasT: ti >= 0 ? data.test_models.seasonal[ti] : undefined,
          };
        }),
        ...data.forecast_mean.map((f, i): Pt => ({ d: `+${i + 1}`, fc: f, lo: data.forecast_low[i], hi: data.forecast_high[i] })),
      ]
    : [];

  const models = data
    ? [
        { id: "SES", name: "SES (engine)", mae: data.model.mae, wape: data.model.wape },
        { id: "7-day MA", name: "7-day MA", mae: data.baseline.mae, wape: data.baseline.wape },
        { id: "seasonal-naive", name: "Seasonal-naive", mae: data.seasonal.mae, wape: data.seasonal.wape },
      ]
    : [];

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">Demand Forecasting</h1>
        <select value={store} onChange={(e) => setStore(e.target.value)} className="glass-input ml-auto" aria-label="Store">
          {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_id} · {s.name}</option>)}
        </select>
        <select value={sku} onChange={(e) => setSku(e.target.value)} className="glass-input" aria-label="SKU">
          {prods.map((p) => <option key={p.sku} value={p.sku}>{p.sku}</option>)}
        </select>
        <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="glass-input" aria-label="Forecast horizon">
          <option value={7}>7-day horizon</option>
          <option value={14}>14-day horizon</option>
        </select>
      </GlassCard>
      {status === "loading" && <Skeleton className="h-72" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={() => api.forecast(store, sku, horizon).then((d) => { setData(d); setStatus("ready"); }).catch((e: unknown) => setMsg(errMsg(e)))} />}
      {status === "ready" && data && (
        <>
          <GlassCard>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="d" fontSize={11} interval={5} stroke="currentColor" opacity={0.6} />
                <YAxis fontSize={12} stroke="currentColor" opacity={0.6} />
                <Tooltip />
                <Legend />
                <Area dataKey="hi" stroke="none" fill="#66E3A1" fillOpacity={0.12} name="80% band" isAnimationActive={false} />
                <Area dataKey="lo" stroke="none" fill="#0B3D2E" fillOpacity={0.25} name="" isAnimationActive={false} />
                <Line dataKey="actual" stroke="#8DA99A" dot={false} name="History (held-out shaded at right)" isAnimationActive={false} />
                <Line dataKey="sesT" stroke="#66E3A1" strokeDasharray="4 2" dot={false} name="SES on held-out" isAnimationActive={false} />
                <Line dataKey="maT" stroke="#d97706" strokeDasharray="4 2" dot={false} name="MA on held-out" isAnimationActive={false} />
                <Line dataKey="seasT" stroke="#38bdf8" strokeDasharray="4 2" dot={false} name="Seasonal on held-out" isAnimationActive={false} />
                <Line dataKey="fc" stroke="#66E3A1" strokeWidth={2} dot={false} name={`Forecast (${data.engine ?? data.winner})`} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs opacity-60">Shaded band = {data.interval_label} (z={data.interval_z}, σ={data.residual_std}). Dashed lines replay each model over the held-out final {data.test_len} days against actual history.</p>
          </GlassCard>
          <GlassCard>
            <h2 className="font-bold">Same held-out {data.test_len} days, three models {data.winner !== "n/a" && <Chip tone="low">winner: {data.winner}</Chip>}</h2>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="text-left text-xs uppercase opacity-50"><th>Model</th><th>MAE</th><th>WAPE</th></tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.name} className="border-t border-white/10">
                    <td className="py-1 font-medium">{m.name} {data.winner === m.id && <Chip tone="low">best</Chip>}</td>
                    <td>{m.mae}</td><td>{m.wape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 rounded bg-emerald-500/10 p-2 text-sm">{data.honesty_note} All three models stay visible; the engine forecast above always comes from that series&apos; held-out winner.</p>
          </GlassCard>
        </>
      )}
      {status === "empty" && <EmptyPanel title="No history" body="Seed the demo to generate 12 weeks of sales." />}
    </div>
  );
}
