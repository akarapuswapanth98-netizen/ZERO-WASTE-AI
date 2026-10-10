"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, EmptyPanel, ErrorPanel, GlassButton, GlassCard, Portal, RiskChip, Skeleton, Toasts, type Toast } from "@/components/glass";
import { api } from "@/lib/api";
import { fmtImpact, fmtMoney } from "@/lib/format";
import { errMsg, type Rec, type RecDetail, type RecStatus, type RiskData, type Status } from "@/lib/types";

const FILTERS: Array<[string, string]> = [["Proposed", "proposed"], ["Approved", "approved"], ["Rejected", "rejected"], ["Executed", "executed"], ["Failed", "failed"], ["Superseded", "superseded"], ["All", ""]];
const PAGE_SIZE = 10;
const URGENCY: Record<string, number> = { markdown: 0, donate: 1, transfer: 2, replenish: 3, "no-action": 4 };

interface Enriched extends Rec {
  band?: string;
  daysLeft?: number;
  forecast7d?: number;
}

function ScoreBars({ id }: { id: string }) {
  const [d, setD] = useState<RecDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    api
      .recDetail(id)
      .then((r) => {
        if (alive) setD(r);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  if (failed) return <p className="text-sm text-red-500">Cost breakdown failed to load.</p>;
  if (!d) return <Skeleton className="h-28" />;
  const scored = [d.params, ...d.alternatives].filter((o) => typeof o.expected_loss === "number");
  const guards = [d.params, ...d.alternatives].filter((o) => o.feasible === false);
  const data = scored.map((o) => ({ name: `${o.action}×${o.quantity}`, loss: o.expected_loss as number }));
  return (
    <div className="mt-2 rounded-xl bg-black/20 p-3">
      <p className="font-semibold">All scored options (lowest expected net impact wins; negative = net benefit)</p>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" fontSize={11} stroke="currentColor" opacity={0.6} />
          <YAxis type="category" dataKey="name" fontSize={11} width={130} stroke="currentColor" opacity={0.8} />
          <Tooltip formatter={(v) => (typeof v === "number" ? fmtMoney(v) : v)} />
          <Bar dataKey="loss" fill="#66E3A1" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((e, i) => <Cell key={i} fill={(e.loss ?? 0) < 0 ? "#66E3A1" : "#F4B860"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ul className="list-disc pl-5 text-xs opacity-80">
        {scored.map((o, i) => <li key={i}>{o.action} ×{o.quantity} — {fmtMoney(o.expected_loss as number)}{o.detail ? ` · ${o.detail}` : ""}</li>)}
      </ul>
      {guards.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {guards.map((o, i) => <li key={`g${i}`}>⛔ {o.action} blocked — {o.reason ?? o.detail}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function Planner() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [enriched, setEnriched] = useState<Record<string, Partial<Pick<Enriched, "band" | "daysLeft" | "forecast7d">>>>({});
  const enriching = recs.length > 0 && recs.some((r) => enriched[r.rec_id] === undefined);
  const [stores, setStores] = useState<Array<{ store_id: string; name: string }>>([]);
  const [filter, setFilter] = useState<RecStatus | "">("proposed");
  const [fStore, setFStore] = useState("");
  const [fCat, setFCat] = useState("");
  const [fAction, setFAction] = useState("");
  const [fRisk, setFRisk] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<{ kind: "approve" | "reject" | "execute"; id: string } | null>(null);
  const [modalQty, setModalQty] = useState("");
  const [modalReason, setModalReason] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkList, setBulkList] = useState<Rec[]>([]);
  const toastId = useRef(0);
  const filterRef = useRef<RecStatus | "">(filter);
  const reduce = useReducedMotion();

  function pushToast(kind: "ok" | "err", text: string) {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }

  useEffect(() => {
    let alive = true;
    api
      .stores()
      .then((s) => {
        if (alive) setStores(s.stores);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.recs(filter ? { status: filter } : {}), api.evaluation()])
      .then(([r, ev]) => {
        if (!alive) return;
        setRecs(r.recommendations);
        const c: Record<string, number> = {};
        ev.recommendation_status.forEach((x) => {
          c[x.status] = x.n;
        });
        setCounts(c);
        setStatus(r.recommendations.length > 0 ? "ready" : "empty");
        setPage(0);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setMsg(errMsg(e));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [filter]);

  // risk context for the current list (band, days left, 7d forecast)
  useEffect(() => {
    if (recs.length === 0) return;
    const missing = recs.filter((r) => enriched[r.rec_id] === undefined).slice(0, 60);
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(
      missing.map((r) =>
        api
          .risk(r.store_id, r.sku)
          .then((d: RiskData): { id: string; band?: string; daysLeft?: number; forecast7d?: number } => ({ id: r.rec_id, band: d.band, daysLeft: d.days_to_first_expiry, forecast7d: d.forecast_7d }))
          .catch((): { id: string; band?: string; daysLeft?: number; forecast7d?: number } => ({ id: r.rec_id })),
      ),
    )
      .then((rows) => {
        if (!alive) return;
        setEnriched((prev) => {
          const next = { ...prev };
          rows.forEach((x) => {
            next[x.id] = { band: x.band, daysLeft: x.daysLeft, forecast7d: x.forecast7d };
          });
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [recs]); // eslint-disable-line react-hooks/exhaustive-deps -- enriched cache is write-only here

  const cats = useMemo(() => [...new Set(recs.map((r) => r.category ?? "other"))].sort(), [recs]);
  const actions = useMemo(() => [...new Set(recs.map((r) => r.action_type))].sort(), [recs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Enriched[] = recs
      .filter((r) => (!fStore || r.store_id === fStore) && (!fCat || (r.category ?? "other") === fCat) && (!fAction || r.action_type === fAction))
      .filter((r) => {
        if (!q) return true;
        return r.sku.toLowerCase().includes(q) || (r.product_name ?? "").toLowerCase().includes(q);
      })
      .map((r) => ({ ...r, ...(enriched[r.rec_id] ?? {}) }))
      .filter((r) => !fRisk || r.band === fRisk)
      .sort((a, b) => (URGENCY[a.action_type] ?? 9) - (URGENCY[b.action_type] ?? 9) || Math.abs(b.expected_loss) - Math.abs(a.expected_loss));
    return rows;
  }, [recs, enriched, fStore, fCat, fAction, fRisk, query]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function refreshWith(f: RecStatus | "") {
    api
      .recs(f ? { status: f } : {})
      .then((r) => {
        setRecs(r.recommendations);
        setStatus(r.recommendations.length > 0 ? "ready" : "empty");
      })
      .catch((e: unknown) => {
        setMsg(errMsg(e));
        setStatus("error");
      });
  }
  function refresh() {
    refreshWith(filterRef.current);
  }
  function changeFilter(f: RecStatus | "") {
    filterRef.current = f;
    setFilter(f);
  }

  async function decide(kind: "approve" | "reject", id: string, qtyRaw: string, reason: string) {
    setBusyId(id);
    try {
      if (kind === "approve") {
        const qty = qtyRaw.trim() === "" ? undefined : Number(qtyRaw);
        if (qty !== undefined && (!Number.isInteger(qty) || qty < 0)) throw new Error("Quantity must be a whole number ≥ 0");
        await api.approve(id, qty === undefined ? { reason } : { reason, qty_adjusted: qty });
        pushToast("ok", `Approved ${id.slice(-6)}${qty !== undefined ? ` ×${qty}` : ""} ✓ — execute it in the simulation next`);
      } else {
        await api.reject(id, { reason });
        pushToast("ok", `Rejected ${id.slice(-6)} — nothing will execute`);
      }
      refresh();
    } catch (e: unknown) {
      pushToast("err", `${kind} blocked: ${errMsg(e)}`);
    } finally {
      setBusyId(null);
      setModal(null);
    }
  }

  async function execute(id: string) {
    setBusyId(id);
    try {
      const r = await api.execute(id);
      pushToast(r.status === "executed" ? "ok" : "err", r.status === "executed" ? `Executed in simulation ✓` : `Failed: ${r.reason}`);
      refresh();
    } catch (e: unknown) {
      pushToast("err", `Execute blocked: ${errMsg(e)}`);
    } finally {
      setBusyId(null);
      setModal(null);
    }
  }

  function openBulk() {
    const low = recs.filter((r) => ["no-action", "markdown", "donate"].includes(r.action_type));
    setBulkList(low);
    setBulkOpen(true);
  }

  return (
    <div className="space-y-4">
      <GlassCard className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-xl font-extrabold">Planner Review & Approval</h1>
          <p className="text-xs opacity-60">
            Nothing executes without approval. Rejected proposals never execute.{" "}
            {FILTERS.filter(([, v]) => v && counts[v]).map(([label, v]) => `${label} ${counts[v] ?? 0}`).join(" · ")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select value={filter} onChange={(e) => changeFilter(e.target.value as RecStatus | "")} className="glass-input" aria-label="Status filter">
            {FILTERS.map(([label, v]) => <option key={v} value={v}>{label}{counts[v] !== undefined ? ` (${counts[v]})` : ""}</option>)}
          </select>
          <GlassButton onClick={openBulk}>Bulk-approve low-risk</GlassButton>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-wrap items-end gap-2 !p-3">
        <select value={fStore} onChange={(e) => setFStore(e.target.value)} className="glass-input" aria-label="Store filter">
          <option value="">All stores</option>
          {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.name}</option>)}
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="glass-input" aria-label="Category filter">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fAction} onChange={(e) => setFAction(e.target.value)} className="glass-input" aria-label="Action filter">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fRisk} onChange={(e) => setFRisk(e.target.value)} className="glass-input" aria-label="Risk filter">
          <option value="">All risk levels</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search SKU / product" className="glass-input" aria-label="Search proposals" />
        {(fStore || fCat || fAction || fRisk || query) && (
          <GlassButton variant="ghost" onClick={() => { setFStore(""); setFCat(""); setFAction(""); setFRisk(""); setQuery(""); }}>Clear</GlassButton>
        )}
        <span className="ml-auto text-xs opacity-60">{visible.length} shown · sorted by urgency{enriching ? " · loading risk context…" : ""}</span>
      </GlassCard>

      <Toasts toasts={toasts} />
      {status === "loading" && <Skeleton className="h-40" />}
      {status === "error" && <ErrorPanel message={msg} onRetry={refresh} />}
      {status === "empty" && <EmptyPanel title={`No ${filter || ""} proposals`} body="Run the agents from Overview to generate one proposal per SKU/store." />}
      {status === "ready" && visible.length === 0 && (
        <EmptyPanel title="No proposals match these filters" body="Loosen a filter or clear the search." action={<GlassButton onClick={() => { setFStore(""); setFCat(""); setFAction(""); setFRisk(""); setQuery(""); }}>Clear filters</GlassButton>} />
      )}
      {status === "ready" && (
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence>
            {pageRows.map((r) => (
              <motion.div key={r.rec_id} data-rec-id={r.rec_id} exit={reduce ? undefined : { opacity: 0, x: 60 }}>
                <GlassCard className="text-sm">
                  <p className="font-bold">{r.product_name ?? r.sku} <span className="font-normal opacity-60">· {r.store_id}</span></p>
                  <p className="font-mono text-xs opacity-50">{r.sku} · {r.category ?? ""}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {r.band ? <RiskChip band={r.band} /> : <Skeleton className="h-5 w-16" />}
                    <Chip tone="plain">qty ×{r.quantity}</Chip>
                    {r.daysLeft !== undefined ? (
                      <Chip tone={r.daysLeft <= 2 ? "high" : "plain"}>{r.daysLeft}d to expiry</Chip>
                    ) : (
                      <Skeleton className="h-5 w-20" />
                    )}
                    {r.forecast7d !== undefined ? <Chip tone="plain">~{r.forecast7d}/7d</Chip> : <Skeleton className="h-5 w-20" />}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold">{r.action_type} ×{r.quantity}</span>
                    <Chip tone="plain">{r.status}</Chip>
                  </p>
                  <p className="mt-1">Expected net impact <b className={r.expected_loss < 0 ? "text-emerald-500" : ""}>{fmtImpact(r.expected_loss)}</b>
                    {r.expected_waste_avoided ? <span className="text-xs opacity-60"> · avoids ~{r.expected_waste_avoided}u waste</span> : null}
                  </p>
                  <p className="mt-1 text-xs opacity-70">{r.explanation}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <GlassButton onClick={() => setOpen(open === r.rec_id ? null : r.rec_id)}>{open === r.rec_id ? "Hide breakdown" : "Why this action?"}</GlassButton>
                    {r.status === "proposed" && (
                      <>
                        <GlassButton variant="primary" loading={busyId === r.rec_id} onClick={() => { setModalQty(""); setModalReason(""); setModal({ kind: "approve", id: r.rec_id }); }}>Approve</GlassButton>
                        <GlassButton variant="danger" loading={busyId === r.rec_id} onClick={() => { setModalQty(""); setModalReason(""); setModal({ kind: "reject", id: r.rec_id }); }}>Reject</GlassButton>
                      </>
                    )}
                    {r.status === "approved" && (
                      <GlassButton variant="primary" loading={busyId === r.rec_id} onClick={() => { setModalQty(""); setModalReason(""); setModal({ kind: "execute", id: r.rec_id }); }}>Execute (sim)</GlassButton>
                    )}
                  </div>
                  {open === r.rec_id && <ScoreBars id={r.rec_id} />}
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {status === "ready" && pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <GlassButton disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Prev</GlassButton>
          <span className="opacity-70">Page {page + 1} of {pages}</span>
          <GlassButton disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next →</GlassButton>
        </div>
      )}
      {status === "ready" && (
        <p className="text-xs opacity-60">Donation recovery assumes 40% of unit cost as goodwill/tax value minus $0.05 handling per unit; only units with ≥1 day of shelf life can be donated.</p>
      )}

      {modal && (
        <Portal>
          <div role="dialog" aria-modal="true" aria-label={modal.kind === "approve" ? "Approve proposal" : modal.kind === "reject" ? "Reject proposal" : "Execute proposal"} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal(null)}>
            <div className="glass w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-lg font-bold">
                {modal.kind === "approve" ? "Approve proposal" : modal.kind === "reject" ? "Reject proposal" : "Execute in simulation"}
              </h2>
              <p className="mt-1 text-sm opacity-70">
                {modal.kind === "approve" && "Optional: adjust quantity within 0..on-hand (non-replenish). A reason is recorded."}
                {modal.kind === "reject" && "Rejected proposals never execute. A reason is recorded."}
                {modal.kind === "execute" && "Approved proposals execute inside the simulation only, with re-checked stock."}
              </p>
              {modal.kind === "approve" && (
                <label className="mt-3 block text-sm">Quantity (empty = recommended)
                  <input value={modalQty} onChange={(e) => setModalQty(e.target.value)} inputMode="numeric" placeholder="recommended" className="glass-input mt-1 w-full" aria-label="Approval quantity" />
                </label>
              )}
              {modal.kind !== "execute" && (
                <label className="mt-3 block text-sm">Reason (recorded in audit)
                  <input value={modalReason} onChange={(e) => setModalReason(e.target.value)} placeholder="optional" className="glass-input mt-1 w-full" aria-label="Decision reason" />
                </label>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <GlassButton variant="ghost" onClick={() => setModal(null)}>Cancel</GlassButton>
                {modal.kind === "execute" ? (
                  <GlassButton variant="primary" loading={busyId === modal.id} onClick={() => void execute(modal.id)}>Confirm execute</GlassButton>
                ) : (
                  <GlassButton variant={modal.kind === "reject" ? "danger" : "primary"} loading={busyId === modal.id} onClick={() => { if (modal.kind !== "execute") void decide(modal.kind, modal.id, modalQty, modalReason); }}>
                    Confirm {modal.kind}
                  </GlassButton>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {bulkOpen && (
        <Portal>
          <div role="dialog" aria-modal="true" aria-label="Bulk approve confirmation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBulkOpen(false)}>
            <div className="glass max-h-[80vh] w-full max-w-lg overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-lg font-bold">Bulk-approve {bulkList.length} low-risk proposals</h2>
              <p className="mt-1 text-sm opacity-70">Only no-action, markdown and donate proposals qualify. Each records an individual decision. Nothing executes until you run it in the simulation.</p>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm">
                {bulkList.map((r) => <li key={r.rec_id} className="border-t border-white/10 py-1">{r.sku} · {r.store_id} — {r.action_type} ×{r.quantity} ({fmtMoney(r.expected_loss)})</li>)}
              </ul>
              {bulkList.length === 0 && <p className="mt-2 text-sm opacity-60">Nothing eligible right now.</p>}
              <div className="mt-4 flex justify-end gap-2">
                <GlassButton variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</GlassButton>
                <GlassButton
                  variant="primary"
                  disabled={bulkList.length === 0}
                  onClick={() => {
                    api
                      .bulk({ reason: "bulk low-risk approve" })
                      .then((r) => {
                        pushToast("ok", `Bulk-approved ${r.bulk_approved} low-risk proposals ✓`);
                        setBulkOpen(false);
                        refresh();
                      })
                      .catch((e: unknown) => pushToast("err", `Bulk failed: ${errMsg(e)}`));
                  }}
                >
                  Confirm bulk ({bulkList.length})
                </GlassButton>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
