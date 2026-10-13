"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Sparkles,
  BarChart3,
  ScrollText,
  Activity,
  Layers,
  TrendingUp,
  ShieldAlert,
  Cpu,
} from "lucide-react";
import { api } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/forecast", label: "Forecast Tourney", icon: TrendingUp },
  { href: "/risk", label: "Risk Simulator", icon: ShieldAlert },
  { href: "/agents", label: "Agent Center", icon: Cpu },
  { href: "/planner", label: "Planner", icon: ClipboardList },
  { href: "/scenarios", label: "Scenarios", icon: Sparkles },
  { href: "/evaluation", label: "Evaluation", icon: BarChart3 },
  { href: "/audit", label: "Audit & Events", icon: ScrollText },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then((data) => setDbHealthy(data.database_connected))
      .catch(() => setDbHealthy(false));
  }, []);

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#101D16]/90 backdrop-blur-xl border-r border-[#2A4033] z-40 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#2A4033]/60 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          {/* Leaf + Circle SVG Logo */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#66E3A1] to-[#1C3A2A] flex items-center justify-center p-2 shadow-glow group-hover:scale-105 transition-transform">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0B1511"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6c-3 0-5 2-5 5 0 3.5 3 6 5 7 2-1 5-3.5 5-7 0-3-2-5-5-5z" fill="#0B1511" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#E8F2EC] group-hover:text-[#66E3A1] transition-colors">
              ZeroWaste AI
            </h1>
            <p className="text-[10px] text-[#9EB5A8] uppercase tracking-wider font-medium">
              Autonomous Grocery
            </p>
          </div>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[#1C3A2A] text-[#66E3A1] border border-[#66E3A1]/30 shadow-sm"
                  : "text-[#9EB5A8] hover:text-[#E8F2EC] hover:bg-[#172A20]/60 border border-transparent"
              )}
            >
              <Icon className={clsx("w-4 h-4", isActive ? "text-[#66E3A1]" : "text-[#9EB5A8]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* System Status & Persistent Synthetic Badge */}
      <div className="p-4 border-t border-[#2A4033]/60 bg-[#0B1511]/40 space-y-3">
        {/* Backend health chip */}
        <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-[#172A20]/70 border border-[#2A4033]">
          <span className="flex items-center gap-2 text-[#9EB5A8]">
            <Activity className="w-3.5 h-3.5" />
            PostgreSQL DB
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                dbHealthy === true
                  ? "bg-[#66E3A1] shadow-[0_0_8px_#66E3A1]"
                  : dbHealthy === false
                  ? "bg-[#FF7D78] shadow-[0_0_8px_#FF7D78]"
                  : "bg-[#F4B860]"
              )}
            />
            <span className={dbHealthy === true ? "text-[#66E3A1]" : "text-[#FF7D78]"}>
              {dbHealthy === true ? "Connected" : dbHealthy === false ? "Offline" : "Checking"}
            </span>
          </span>
        </div>

        {/* Required persistent banner badge */}
        <div className="px-2.5 py-2 rounded-lg bg-[#1C3A2A]/40 border border-[#2A4033] text-[11px] text-[#9EB5A8] text-center font-medium leading-relaxed">
          <span className="inline-block text-[#66E3A1] font-semibold mr-1">●</span>
          Demo Mode · Synthetic data · Simulated integrations
        </div>
      </div>
    </aside>
  );
};
