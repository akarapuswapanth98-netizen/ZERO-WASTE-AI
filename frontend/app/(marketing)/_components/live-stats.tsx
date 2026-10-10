"use client";
import { useEffect, useMemo, useState } from "react";
import { CountUp, GlassCard, Skeleton } from "@/components/glass";
import { api } from "@/lib/api";
import { asofMs, useAsof } from "@/lib/useAsof";
import type { Batch, Rec } from "@/lib/types";

const DAY = 86400000;

export default function LiveStats() {
  const [inv, setInv] = useState<Batch[] | null>(null);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [forecast, setForecast] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.inventory(), api.recs()])
      .then(([invOut, recOut]) => {
        if (!alive) return;
        setInv(invOut.inventory);
        setRecs(recOut.recommendations);
        const bySku = new Map<string, number>();
        invOut.inventory.forEach((b) => {
          if (b.store_id === "store_001") bySku.set(b.sku, (bySku.get(b.sku) ?? 0) + b.qty_on_hand);
        });
        const top = [...bySku.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([sku]) => sku);
        Promise.all(top.map((sku) => api.forecast("store_001", sku, 7)))
          .then((fs) => {
            if (alive) setForecast(fs.reduce((s, f) => s + f.forecast_mean.reduce((a, x) => a + x, 0), 0));
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const asof = useAsof();
  const exp48 = useMemo(() => {
    if (!inv) return null;
    const base = asofMs(asof);
    return inv.filter((x) => new Date(x.expiry_date).getTime() - base <= 2 * DAY).reduce((s, x) => s + x.qty_on_hand, 0);
  }, [inv, asof]);
  const pending = useMemo(
    () => (recs ? recs.filter((x) => x.status === "proposed" && x.action_type !== "no-action").length : null),
    [recs],
  );

  if (failed) {
    return (
      <GlassCard>
        <h2 className="font-display text-xl font-extrabold">Live from the demo</h2>
        <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Demo data unavailable right now — the backend may be cold-starting. Open the app and press Seed demo, then come back.</p>
      </GlassCard>
    );
  }

  const cards = [
    { label: "Units expiring in 48h", value: exp48 },
    { label: "Pending approvals", value: pending },
    { label: "7-day forecast units", value: forecast !== null ? Math.round(forecast) : null },
  ];
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold">Live from the demo</h2>
      <p className="text-xs opacity-60">Fetched from the live API right now — never hardcoded.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <GlassCard key={c.label} className="!p-4">
            <p className="text-[11px] uppercase tracking-wider opacity-60">{c.label}</p>
            {c.value === null ? (
              <Skeleton className="mt-1 h-8" />
            ) : (
              <p className="font-display text-2xl font-extrabold"><CountUp value={c.value} /></p>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
