import React from "react";
import { clsx } from "clsx";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glow = false,
  ...props
}) => {
  return (
    <div
      className={clsx(
        "glass-card rounded-xl p-5 relative overflow-hidden transition-all duration-200",
        glow && "hover:shadow-glow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
