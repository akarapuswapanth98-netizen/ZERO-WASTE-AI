import React from "react";
import { clsx } from "clsx";

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
