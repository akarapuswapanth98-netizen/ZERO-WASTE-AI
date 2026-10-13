import React from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B1511] disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  const variantStyles = {
    primary:
      "bg-[#66E3A1] text-[#0B1511] hover:bg-[#43C985] active:scale-[0.98] shadow-sm hover:shadow-glow focus:ring-[#66E3A1] font-semibold",
    secondary:
      "bg-[rgba(23,42,32,0.8)] text-[#E8F2EC] border border-[#2A4033] hover:bg-[rgba(28,58,42,0.8)] hover:border-[#66E3A1]/40 active:scale-[0.98] focus:ring-[#66E3A1]",
    danger:
      "bg-[#FF7D78]/20 text-[#FF7D78] border border-[#FF7D78]/40 hover:bg-[#FF7D78]/30 hover:border-[#FF7D78] active:scale-[0.98] focus:ring-[#FF7D78] font-semibold",
    ghost:
      "bg-transparent text-[#9EB5A8] hover:text-[#E8F2EC] hover:bg-[#172A20]/60 active:scale-[0.98] focus:ring-[#66E3A1]",
  };

  return (
    <button
      className={clsx(
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        loading && "cursor-wait",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
      {children}
    </button>
  );
};
