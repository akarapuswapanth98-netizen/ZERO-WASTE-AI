"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Portal({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const id = window.requestAnimationFrame(() => setEl(div));
    return () => {
      window.cancelAnimationFrame(id);
      div.remove();
    };
  }, []);
  if (!el) return null;
  return createPortal(children, el);
}

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={`glass p-4 sm:p-5 ${className}`}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {children}
    </motion.section>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}
export function GlassButton({ variant = "secondary", loading = false, children, className = "", disabled, ...rest }: BtnProps) {
  return (
    <button
      className={`btn ${variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : variant === "ghost" ? "btn-ghost" : "btn-secondary"} px-4 py-2 text-sm ${className}`}
      disabled={disabled ?? loading}
      {...rest}
    >
      {loading ? <span className="pulse-dot">Working…</span> : children}
    </button>
  );
}

export function Chip({ tone, children }: { tone: "low" | "med" | "high" | "plain"; children: ReactNode }) {
  const cls = tone === "low" ? "badge-low" : tone === "med" ? "badge-med" : tone === "high" ? "badge-high" : "bg-stone-500/15";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function RiskChip({ band }: { band: string }) {
  return <Chip tone={band === "High" ? "high" : band === "Medium" ? "med" : "low"}>{band} risk</Chip>;
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div role="status" aria-label="Loading" className={`skeleton ${className}`} />;
}

export function ErrorPanel({ message, onRetry, hint }: { message: string; onRetry: () => void; hint?: string }) {
  return (
    <div role="alert" className="glass border-red-500/40 p-6">
      <p className="font-bold text-red-500">Something failed</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
      <GlassButton onClick={onRetry} className="mt-3">Retry</GlassButton>
    </div>
  );
}

export function EmptyPanel({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="glass p-6 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" className="mx-auto opacity-70" aria-hidden>
        <rect x="10" y="26" width="52" height="34" rx="6" fill="none" stroke="#10b981" strokeWidth="3" />
        <path d="M18 26v-6a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v6" fill="none" stroke="#10b981" strokeWidth="3" />
        <path d="M30 44c2-5 6-8 12-8-1 6-5 10-12 8z" fill="#10b981" opacity="0.7" />
      </svg>
      <p className="mt-2 font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm opacity-70">{body}</p>
      {action ? <div className="mt-3 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const t0 = performance.now();
    const target = value;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setShown(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  const display = reduce === true ? value : shown;
  return <>{format ? format(display) : Math.round(display).toLocaleString()}</>;
}

export interface Toast { id: number; kind: "ok" | "err"; text: string; }
export function Toasts({ toasts }: { toasts: Toast[] }) {
  const reduce = useReducedMotion();
  return (
    <Portal>
      <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-80 flex-col gap-2 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`glass px-4 py-2.5 text-sm ${t.kind === "ok" ? "border-emerald-500/50" : "border-red-500/50"}`}
            initial={reduce ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {t.text}
          </motion.div>
        ))}
      </div>
    </Portal>
  );
}
