import React from "react";
import { clsx } from "clsx";

interface StatusBadgeProps {
  status: "Low" | "Medium" | "High" | "pending" | "approved" | "rejected" | "executed" | "failed" | string;
  size?: "sm" | "md";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md", className }) => {
  const normalized = status.toLowerCase();

  let styles = "bg-[#2A4033] text-[#9EB5A8] border-[#2A4033]";
  let dotColor = "bg-[#9EB5A8]";

  if (normalized === "low" || normalized === "executed" || normalized === "approved" || normalized === "healthy") {
    styles = "bg-[#66E3A1]/15 text-[#66E3A1] border-[#66E3A1]/30";
    dotColor = "bg-[#66E3A1]";
  } else if (normalized === "medium" || normalized === "pending" || normalized === "warning") {
    styles = "bg-[#F4B860]/15 text-[#F4B860] border-[#F4B860]/30";
    dotColor = "bg-[#F4B860]";
  } else if (normalized === "high" || normalized === "failed" || normalized === "rejected" || normalized === "danger" || normalized === "urgent") {
    styles = "bg-[#FF7D78]/15 text-[#FF7D78] border-[#FF7D78]/30";
    dotColor = "bg-[#FF7D78]";
  }

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium rounded-full border select-none capitalize",
        styles,
        sizeClasses,
        className
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full", dotColor)} />
      {status}
    </span>
  );
};
