import React from "react";
import { clsx } from "clsx";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className, ...props }) => {
  return (
    <div className={clsx("glass-panel rounded-2xl p-6", className)} {...props}>
      {children}
    </div>
  );
};

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const GlassInput: React.FC<GlassInputProps> = ({ className, ...props }) => {
  return (
    <input
      className={clsx(
        "glass-input rounded-lg px-3.5 py-2 text-sm placeholder-[#6B8576] transition-all",
        className
      )}
      {...props}
    />
  );
};
