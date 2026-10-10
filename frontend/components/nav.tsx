"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAsof } from "@/lib/useAsof";

export function DemoBadge() {
  return (
    <span
      className="inline-block cursor-help rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold"
      title="Demo workspace: synthetic data (seed 42, dates relative to reset day); POS/WMS/ERP integrations are simulated; Gemini explanations use templates without a key."
    >
      DEMO
    </span>
  );
}

export function AsofBadge() {
  const asof = useAsof();
  return <span className="text-[11px] opacity-70">As of {asof ?? "…"}</span>;
}

const NAV: Array<[string, string, string]> = [
  ["Overview", "/overview", "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10"],
  ["Shelves 3D", "/inventory", "M4 7h16M4 12h16M4 17h16M6 4v16M18 4v16"],
  ["Forecast", "/forecast", "M3 17l5-6 4 3 6-8 3 3"],
  ["Risk", "/risk", "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"],
  ["Agents", "/agents", "M9 3h6v4l3 3v9H6v-9l3-3V3zM10 13h4"],
  ["Planner", "/planner", "M5 4h14v12H9l-4 4V4zM8 9l2 2 4-4"],
  ["Scenarios", "/scenarios", "M4 6h12M4 12h8M4 18h10M17 10l4 4-4 4"],
  ["Evaluation", "/evaluation", "M5 20V10M12 20V4M19 20v-7"],
  ["Audit", "/audit", "M6 3h9l4 4v14H6V3zM9 12h7M9 16h7"],
];

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  return (
    <button
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("zw-theme", next ? "dark" : "light");
        } catch {
          /* storage unavailable */
        }
      }}
      className="glass-input"
    >
      {dark ? "☀ Light" : "🌙 Dark"}
    </button>
  );
}

export function Logo() {
  return (
    <Link href="/overview" className="flex items-center gap-2.5" aria-label="ZeroWaste AI home">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-900 text-[#0B3D2E]" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 6c3 2 4 5 3 8-3 1-6 0-8-3 2 0 3-1 4-2-1-1-1-2 1-3z" fill="currentColor" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="font-display block text-[15px] font-bold tracking-tight">ZeroWaste AI</span>
        <span className="block text-[10px] uppercase tracking-[0.14em] opacity-60">Smarter grocery inventory</span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto p-4 lg:flex" aria-label="Primary">
      <div className="glass p-3"><Logo /></div>
      <nav className="glass mt-3 flex flex-col gap-1 p-2">
        {NAV.map(([label, href, d]) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-emerald-500/25 font-bold shadow-[0_0_18px_rgba(16,185,129,0.35)]" : "hover:bg-white/10"}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d={d} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="glass mt-auto p-3 text-[11px] leading-relaxed opacity-80">
        <p className="flex items-center gap-2"><DemoBadge /> <AsofBadge /></p>
        <p className="mt-1">Synthetic seed=42 · integrations simulated.</p>
        <div className="mt-2"><ThemeToggle /></div>
      </div>
    </aside>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 p-3 lg:hidden">
      <div className="glass flex items-center gap-2 px-3 py-2">
        <Logo />
        <span className="ml-auto flex items-center gap-2"><AsofBadge /><DemoBadge /></span>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 lg:hidden" aria-label="Primary mobile">
      <div className="glass flex gap-1 overflow-x-auto p-2">
        {NAV.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${path === href ? "bg-emerald-500/30 font-bold" : "opacity-80"}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
