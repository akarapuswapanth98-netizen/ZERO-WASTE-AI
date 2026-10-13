"use client";

import React from "react";
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
} from "lucide-react";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/planner", label: "Planner", icon: ClipboardList },
  { href: "/scenarios", label: "Sim", icon: Sparkles },
  { href: "/evaluation", label: "Eval", icon: BarChart3 },
  { href: "/audit", label: "Audit", icon: ScrollText },
];

export const MobileNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#101D16]/95 backdrop-blur-xl border-t border-[#2A4033] z-50 flex items-center justify-around px-2">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-xs font-medium transition-colors",
              isActive ? "text-[#66E3A1]" : "text-[#9EB5A8] hover:text-[#E8F2EC]"
            )}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
