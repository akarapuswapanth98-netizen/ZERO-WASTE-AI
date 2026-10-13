"use client";

import React, { useEffect } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0B1511]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={clsx(
          "relative z-10 w-full max-w-lg glass-panel rounded-2xl p-6 border border-[#2A4033] shadow-2xl animate-in fade-in zoom-in-95 duration-150",
          className
        )}
      >
        <div className="flex items-start justify-between pb-4 border-b border-[#2A4033]">
          <div>
            <h3 className="text-lg font-semibold text-[#E8F2EC]">{title}</h3>
            {description && <p className="text-sm text-[#9EB5A8] mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-[#9EB5A8] hover:text-[#E8F2EC] p-1 rounded-lg hover:bg-[#172A20] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
