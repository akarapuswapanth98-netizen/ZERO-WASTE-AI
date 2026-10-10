"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Chip, EmptyPanel, ErrorPanel, GlassButton, GlassCard, RiskChip, Skeleton } from "@/components/glass";
import { api } from "@/lib/api";
import { errMsg, type Batch, type RiskData, type Status, type Store } from "@/lib/types";
import { asofMs, useAsof } from "@/lib/useAsof";
import type { ShelfGroup } from "./scene";

const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => <Skeleton className="h-[420px]" /> });
const CATS = ["dairy", "bakery", "produce", "meat", "seafood", "ready-to-eat"];

export default function InventoryPage() {
  const [inv, setInv] = useState<Batch[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState("store_001");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"expiry_date" | "qty_on_hand">("expiry_date");
  const [day, setDay] = useState(0);
  const [sel, setSel] = useState<{ store_id: string; sku: string; name: string } | null>(null);
  const selectedKey = sel ? `${sel.store_id}|${sel.sku}` : null;
  const [detail, setDetail] = useState<RiskData | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const [webglOk, setWebglOk] = useState(false);
  const asof = useAsof();
  const baseMs = asofMs(asof);
  function select(s: { store_id: string; sku: string; name: string }) {
    setDetail(null);
    setDetailState("loading");
    setSel(s);
  }

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        const c = document.createElement("canvas");
        const gl = window.WebGLRenderingContext ? (c.getContext("webgl") ?? c.getContext("experimental-webgl")) : null;
        setWebglOk(gl !== null && window.innerWidth >= 768);
      } catch {
        setWebglOk(false);
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const params: Record<string, string> = { sort, order: "asc" };
    if (store) params.store_id = store;
    if (cat) params.category = cat;
    if (q) params.search = q;
    Promise.all([api.inventory(params), api.stores()])
      .then(([invOut, sOut]) => {
        if (!alive) return;
        setInv(invOut.inventory);
        setStores(sOut.stores);
        setStatus(invOut.inventory.length > 0 ? "ready" : "empty");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setMsg(errMsg(e));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [store, cat, sort, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- q applied on Apply click via tick

  // Backend recompute: same FIFO engine with day_offset (no client-side date shifting).
  // Loading state is set in the select/slider event handlers below (not in the effect).
  useEffect(() => {
    if (!sel) return;
    let alive = true;
    api
      .risk(sel.store_id, sel.sku, 0.1, 0.3, day)
      .then((d) => {
        if (alive) {
          setDetail(d);
          setDetailState("ready");
        }
      })
      .catch(() => {
        if (alive) setDetailState("error");
      });
    return () => {
      alive = false;
    };
  }, [sel, day]);

  const grouped: ShelfGroup[] = useMemo(() => {
    const m = new Map<string, Batch[]>();
    inv.forEach((b) => {
      const k = `${b.store_id}|${b.sku}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)?.push(b);
    });
    const base = baseMs;
    return [...m.entries()].map(([k, lots]) => {
      const f = lots[0];
      const qty = lots.reduce((s, x) => s + x.qty_on_hand, 0);
      const firstExp = lots.map((x) => x.expiry_date).sort()[0];
      const rem = Math.round((new Date(firstExp).getTime() - base) / 86400000) - day;
      const st: ShelfGroup["status"] = rem <= 2 ? "red" : rem <= 5 ? "amber" : "green";
      return { key: k, store_id: f.store_id, sku: f.sku, name: f.name ?? f.sku, category: f.category ?? "", qty, firstExp, rem, status: st };
    });
  }, [inv, day, baseMs]);

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-end gap-2">
        <div>
          <h1 className="font-display text-xl font-extrabold">3D Inventory Explorer</h1>
          <p className="text-xs opacity-60">Isometric shelves · colour = backend risk at Day +{day} (same FIFO engine).</p>
        </div>
        <select value={store} onChange={(e) => setStore(e.target.value)} className="glass-input" aria-label="Store filter">
          <option value="">All stores</option>
          {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.name}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="glass-input" aria-label="Category filter">
          <option value="">All categories</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setTick((t) => t + 1); }} placeholder="Search SKU / name" className="glass-input" aria-label="Search inventory" />
        <GlassButton onClick={() => setTick((t) => t + 1)}>Apply</GlassButton>
        <label className="ml-auto text-sm">Time-travel: Day +{day}
          <input type="range" min={0} max={7} value={day} onChange={(e) => { setDay(Number(e.target.value)); if (sel) setDetailState("loading"); }} className="ml-2 align-middle" aria-label="Time travel days" />
        </label>
      </GlassCard>

      {status === "loading" && <Skeleton className="h-40" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={() => setTick((t) => t + 1)} />}
      {status === "empty" && <EmptyPanel title="No batches match" body="Clear filters or seed the demo." />}

      {webglOk && store !== "" && status === "ready" && (
        <GlassCard className="overflow-hidden !p-0">
          <Suspense fallback={<Skeleton className="h-[480px]" />}>
            <Scene items={grouped} selectedKey={selectedKey} onSelect={(k) => {
              const g = grouped.find((x) => x.key === k);
              if (g) select({ store_id: g.store_id, sku: g.sku, name: g.name });
            }} />
          </Suspense>
          <p className="px-4 pb-2 text-[11px] opacity-60">One store at a time in 3D (draw-call budget); the table below covers every store. LED + shelf glow show backend risk; click a shelf for detail.</p>
        </GlassCard>
      )}
      {webglOk && store === "" && status === "ready" && (
        <GlassCard><p className="text-sm opacity-70">Pick a single store above for the 3D view (one store keeps the scene under budget). The table below already covers all stores.</p></GlassCard>
      )}
      {!webglOk && status === "ready" && <GlassCard><p className="text-sm opacity-70">2D fallback active (mobile, reduced motion, or no WebGL). All data identical — nothing is hidden.</p></GlassCard>}

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <GlassCard className="overflow-auto !p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase opacity-50">
                <th className="p-2"><button onClick={() => setSort("expiry_date")} className="underline">Expiry {sort === "expiry_date" ? "↓" : ""}</button></th>
                <th className="p-2">SKU / Product</th><th className="p-2">Store</th>
                <th className="p-2"><button onClick={() => setSort("qty_on_hand")} className="underline">Qty {sort === "qty_on_hand" ? "↓" : ""}</button></th>
                <th className="p-2">Status (+{day}d)</th>
              </tr>
            </thead>
            <tbody>
              {grouped.slice(0, 150).map((g) => (
                <tr key={g.key} onClick={() => select({ store_id: g.store_id, sku: g.sku, name: g.name })} className="cursor-pointer border-t border-white/10 hover:bg-emerald-500/10">
                  <td className="p-2">{g.firstExp} ({g.rem}d)</td>
                  <td className="p-2 font-medium">{g.sku} · {g.name}</td>
                  <td className="p-2">{g.store_id}</td>
                  <td className="p-2">{g.qty}</td>
                  <td className="p-2"><Chip tone={g.status === "red" ? "high" : g.status === "amber" ? "med" : "low"}>{g.status}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
        <GlassCard className="text-sm">
          {!sel && <p className="opacity-60">Select a product (3D or table) for batches, backend risk at Day +{day}, and planner links.</p>}
          {sel && (
            <div className="space-y-2">
              <h2 className="font-bold">{sel.sku} · {sel.name}</h2>
              <p className="opacity-70">Store {sel.store_id} · {grouped.find((g) => g.sku === sel.sku && g.store_id === sel.store_id)?.qty ?? 0} units</p>
              {detailState === "loading" && <Skeleton className="h-20" />}
              {detailState === "error" && <p className="text-red-500">Risk lookup failed.</p>}
              {detailState === "ready" && detail && (
                <>
                  <p><RiskChip band={detail.band} /> <span className="text-xs opacity-60">ratio {(detail.risk_ratio * 100).toFixed(1)}% · range {JSON.stringify(detail.risk_range)} · eff. {detail.effective_date}</span></p>
                  <p>{detail.reason}</p>
                  <p className="text-xs opacity-60">At-risk {detail.at_risk_mean}u of {detail.on_hand}u. {detail.disclaimer}</p>
                  <Link href="/planner" className="btn btn-primary inline-block px-4 py-1.5 text-sm">Review in Planner</Link>
                </>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
