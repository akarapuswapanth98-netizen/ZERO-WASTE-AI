"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, CountUp, EmptyPanel, ErrorPanel, GlassButton, GlassCard, Skeleton, Toasts, type Toast } from "@/components/glass";
import { DemoBadge } from "@/components/nav";
import { api } from "@/lib/api";
import { errMsg, type Batch, type Rec, type Status } from "@/lib/types";
import { asofMs, setAsofCache, useAsof } from "@/lib/useAsof";

const HeroScene = dynamic(() => import("@/components/hero3d"), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0" />,
});

const DAY = 86400000;

function useWebGL(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        const c = document.createElement("canvas");
        const gl = window.WebGLRenderingContext ? (c.getContext("webgl") ?? c.getContext("experimental-webgl")) : null;
        setOk(gl !== null && window.innerWidth >= 768 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch {
        setOk(false);
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  return ok;
}

function HeroFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B3D2E] via-[#0a2a20] to-[#111827]" />
      <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        <circle cx="560" cy="190" r="90" fill="none" stroke="#10B981" strokeWidth="2" opacity="0.7" />
        <circle cx="560" cy="190" r="130" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
        <circle cx="440" cy="150" r="18" fill="#dc2626" opacity="0.8" />
        <rect x="660" y="120" width="34" height="42" rx="6" fill="#d97706" opacity="0.8" />
        <ellipse cx="500" cy="260" rx="26" ry="14" fill="#059669" opacity="0.8" />
        <path d="M610 240l22-14 6 26-22 14z" fill="#38bdf8" opacity="0.8" />
      </svg>
    </div>
  );
}

function ArmButton({ label, armedLabel, onFire, loading }: { label: string; armedLabel: string; onFire: () => void; loading: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(id);
  }, [armed]);
  return (
    <GlassButton
      loading={loading}
      className="!text-white"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onFire();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? armedLabel : label}
    </GlassButton>
  );
}

export default function Overview() {
  const [inv, setInv] = useState<Batch[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [forecast7d, setForecast7d] = useState<number | null>(null);
  const [forecastLabel, setForecastLabel] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const webgl = useWebGL();
  const asof = useAsof();
  const baseMs = asofMs(asof);

  function pushToast(kind: "ok" | "err", text: string) {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }

  useEffect(() => {
    let alive = true;
    Promise.all([api.inventory(), api.recs()])
      .then(([invOut, recOut]) => {
        if (!alive) return;
        setInv(invOut.inventory);
        setRecs(recOut.recommendations);
        setStatus(invOut.inventory.length === 0 ? "empty" : "ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setMsg(errMsg(e));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    if (inv.length === 0) return;
    let alive = true;
    const bySku = new Map<string, number>();
    inv.forEach((b) => {
      if (b.store_id === "store_001") bySku.set(b.sku, (bySku.get(b.sku) ?? 0) + b.qty_on_hand);
    });
    const top = [...bySku.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([sku]) => sku);
    Promise.all(top.map((sku) => api.forecast("store_001", sku, 7)))
      .then((fs) => {
        if (!alive) return;
        setForecast7d(fs.reduce((s, f) => s + f.forecast_mean.reduce((a, x) => a + x, 0), 0));
        setForecastLabel(`Top ${top.length} SKUs · Downtown Fresh`);
      })
      .catch(() => {
        if (alive) setForecast7d(null);
      });
    return () => {
      alive = false;
    };
  }, [inv]);

  const stats = useMemo(() => {
    const units = inv.reduce((s, x) => s + x.qty_on_hand, 0);
    const value = inv.reduce((s, x) => s + x.qty_on_hand * (x.unit_price ?? 0), 0);
    const exp48 = inv
      .filter((x) => new Date(x.expiry_date).getTime() - baseMs <= 2 * DAY)
      .reduce((s, x) => s + x.qty_on_hand, 0);
    const exp3d = inv
      .filter((x) => new Date(x.expiry_date).getTime() - baseMs <= 3 * DAY)
      .reduce((s, x) => s + x.qty_on_hand, 0);
    const actionable = recs.filter((x) => x.status === "proposed" && x.action_type !== "no-action");
    const watch = recs.filter((x) => x.status === "proposed" && x.action_type === "no-action");
    const kg = inv.reduce((s, x) => s + x.qty_on_hand * (x.unit_weight_kg ?? 0.4), 0);
    return { units, value, exp48, exp3d, pending: actionable.length, watch: watch.length, kg };
  }, [inv, recs, baseMs]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    inv.forEach((x) => m.set(x.category ?? "other", (m.get(x.category ?? "other") ?? 0) + x.qty_on_hand));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [inv]);

  const health = useMemo(() => {
    let red = 0, amber = 0, green = 0;
    inv.forEach((x) => {
      const d = (new Date(x.expiry_date).getTime() - baseMs) / DAY;
      if (d <= 2) red += x.qty_on_hand;
      else if (d <= 5) amber += x.qty_on_hand;
      else green += x.qty_on_hand;
    });
    return [
      { name: "Urgent ≤2d", value: red },
      { name: "Watch ≤5d", value: amber },
      { name: "Healthy", value: green },
    ];
  }, [inv, baseMs]);

  async function seed() {
    setBusy(true);
    try {
      const r = await api.reset(42);
      setAsofCache(r.asof ?? null);
      setTick((t) => t + 1);
      pushToast("ok", `Seeded ${r.counts.products} SKUs · ${r.counts.stores} stores, as of ${r.asof ?? "?"} ✓`);
    } catch (e: unknown) {
      pushToast("err", `Seed failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }
  async function runAgents() {
    setBusy(true);
    try {
      const r = await api.runAgents({});
      setTick((t) => t + 1);
      pushToast("ok", `${r.count} proposals ready for review ✓`);
    } catch (e: unknown) {
      pushToast("err", `Agent run failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* HERO */}
      <section className="glass relative min-h-[72vh] overflow-hidden" aria-label="ZeroWaste AI introduction">
        {webgl ? (
          <div className="absolute inset-y-0 right-0 w-full lg:w-[58%]">
            <Suspense fallback={<div className="skeleton absolute inset-0" />}>
              <HeroScene />
            </Suspense>
          </div>
        ) : (
          <HeroFallback />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" aria-hidden />
        <div className="relative flex min-h-[72vh] max-w-2xl flex-col justify-end p-6 text-white sm:p-10">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            GDGoC HITAM · Agentic AI Hackathon <DemoBadge />
          </p>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight drop-shadow-lg sm:text-5xl">
            ZeroWaste AI — Agentic Intelligence for Smarter Grocery Inventory
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-50/90 sm:text-base">
            Forecast demand · estimate spoilage · one proposed action per SKU/store · planner approves.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="glass px-4 py-2 text-sm text-white">
              <span className="opacity-70">Expiring 48h:</span> <b>{status === "ready" ? <CountUp value={stats.exp48} /> : "…"}</b> units
            </div>
            <div className="glass px-4 py-2 text-sm text-white">
              <span className="opacity-70">7d forecast:</span> <b>{forecast7d !== null ? <CountUp value={forecast7d} /> : "…"}</b> units
              <span className="ml-1 text-[11px] opacity-60">{forecastLabel}</span>
            </div>
            <div className="glass px-4 py-2 text-sm text-white">
              <span className="opacity-70">Pending approvals:</span> <b>{status === "ready" ? <CountUp value={stats.pending} /> : "…"}</b>
              {stats.watch > 0 && <span className="ml-1 text-[11px] opacity-60">+{stats.watch} watch (no-action)</span>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 pb-2">
            <Link href="/planner" className="btn btn-primary px-5 py-2.5 text-sm">Review proposals</Link>
            <Link href="/inventory" className="btn btn-secondary px-5 py-2.5 text-sm !text-white">Explore shelves</Link>
            <div className="relative">
              <GlassButton onClick={() => setMenuOpen((o) => !o)} className="!text-white" aria-haspopup="menu" aria-expanded={menuOpen}>
                Demo tools ▾
              </GlassButton>
              {menuOpen && (
                <div role="menu" className="glass absolute bottom-12 left-0 z-30 flex w-64 flex-col gap-2 p-3">
                  <p className="text-xs opacity-70">Destructive actions ask for a second click to confirm.</p>
                  <ArmButton label="Seed demo" armedLabel="Click again: wipe + reseed" onFire={() => { setMenuOpen(false); void seed(); }} loading={busy} />
                  <ArmButton label="Run agents" armedLabel="Click again: 90 proposals" onFire={() => { setMenuOpen(false); void runAgents(); }} loading={busy} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Toasts toasts={toasts} />
      {status === "loading" && <Skeleton className="h-40" />}
      {status === "error" && (
        <ErrorPanel
          message={msg}
          onRetry={() => setTick((t) => t + 1)}
          hint="Start the backend: uvicorn app.main:app --port 8000 in zerowaste-ai/backend."
        />
      )}
      {status === "empty" && (
        <EmptyPanel title="No inventory yet" body="Seed the synthetic demo (5 stores, 18 SKUs, seed=42) to populate every page." action={<GlassButton variant="primary" onClick={() => void seed()} loading={busy}>Seed now</GlassButton>} />
      )}
      {status === "ready" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Units on hand", stats.units, (n: number) => Math.round(n).toLocaleString()],
              ["Est. value", stats.value, (n: number) => `$${Math.round(n).toLocaleString()}`],
              ["Expiring ≤3d", stats.exp3d, (n: number) => Math.round(n).toLocaleString()],
              ["Pending approvals", stats.pending, (n: number) => Math.round(n).toLocaleString()],
              ["Food on shelves", stats.kg, (n: number) => `${Math.round(n).toLocaleString()} kg`],
            ].map(([label, v, fmt]) => (
              <GlassCard key={label as string} className="!p-4">
                <p className="text-[11px] uppercase tracking-wider opacity-60">{label as string}</p>
                <p className="font-display text-2xl font-extrabold"><CountUp value={v as number} format={fmt as (n: number) => string} /></p>
              </GlassCard>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <GlassCard>
              <h2 className="font-bold">Stock by category (units)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byCat}>
                  <XAxis dataKey="name" fontSize={11} stroke="currentColor" opacity={0.6} interval={0} angle={-18} dy={10} height={52} />
                  <YAxis fontSize={12} stroke="currentColor" opacity={0.6} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" radius={[8, 8, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
            <GlassCard>
              <h2 className="font-bold">Shelf health (units)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={health} dataKey="value" nameKey="name" outerRadius={80} label isAnimationActive={false}>
                    {health.map((_, i) => <Cell key={i} fill={["#dc2626", "#d97706", "#10B981"][i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs opacity-60">Red ≤2d to expiry · Amber ≤5d · Green &gt;5d. Same colours as the 3D explorer.</p>
            </GlassCard>
          </div>
          <GlassCard>
            <h2 className="font-bold">Sustainability (simulated)</h2>
            <p className="text-sm opacity-70">Assumption shown: <code>2.5 kg CO₂e per kg food</code>; unit weights from the product table. Approve markdown/donate/transfer in <Link className="underline" href="/planner">Planner</Link> to cut it.</p>
            <p className="mt-1 flex items-center gap-2 text-lg">Potential CO₂e on shelves: <b><CountUp value={stats.kg * 2.5} format={(n) => `${Math.round(n).toLocaleString()} kg`} /></b> <Chip tone="low">simulated</Chip></p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
