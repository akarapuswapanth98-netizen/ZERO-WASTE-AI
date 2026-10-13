"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Bot, ShieldCheck, Zap, Activity } from "lucide-react";

export const StartupLoader: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(15);
  const [stepIndex, setStepIndex] = useState(0);

  const BOOT_STEPS = [
    "Mounting PostgreSQL Pool Connection (Port 5433)...",
    "Initializing 5 Retail Stores & Topology Mesh...",
    "Calibrating Seasonal-Naive, MA-7 & SES Tournaments...",
    "Activating FIFO Spoilage Horizons & Risk Classifiers...",
    "ZeroWaste Agentic Intelligence Online.",
  ];

  useEffect(() => {
    // Only run on first load of session
    const hasLoaded = sessionStorage.getItem("zerowaste_booted");
    if (hasLoaded) {
      setVisible(false);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setVisible(false);
            sessionStorage.setItem("zerowaste_booted", "true");
          }, 350);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 25) + 12;
        return next > 100 ? 100 : next;
      });
    }, 140);

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev < BOOT_STEPS.length - 1 ? prev + 1 : prev));
    }, 280);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080F0C]/95 backdrop-blur-2xl transition-opacity duration-500 select-none">
      {/* Background Cyber Mesh */}
      <div className="absolute inset-0 vibe-grid opacity-30 pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#00F0FF]/15 via-[#00FF9D]/15 to-[#B026FF]/15 blur-3xl pointer-events-none animate-pulseSlow" />

      {/* 3D Wireframe Spinning Gyroscope */}
      <div className="relative w-44 h-44 flex items-center justify-center mb-8">
        {/* Outer Cyan Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00F0FF] animate-[spin_8s_linear_infinite] shadow-[0_0_25px_rgba(0,240,255,0.4)]" />
        {/* Middle Violet Counter-Rotating Ring */}
        <div className="absolute inset-4 rounded-full border-2 border-dotted border-[#B026FF] animate-[spin_5s_linear_infinite_reverse] shadow-[0_0_25px_rgba(176,38,255,0.4)]" />
        {/* Inner Emerald Ring */}
        <div className="absolute inset-8 rounded-full border-2 border-solid border-[#00FF9D]/70 animate-[spin_3s_linear_infinite] shadow-[0_0_20px_rgba(0,255,157,0.5)]" />

        {/* Center Quantum AI Core */}
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#13231B] to-[#080F0C] border border-[#00FF9D] flex items-center justify-center shadow-[0_0_30px_rgba(0,255,157,0.7)]">
          <Bot className="w-8 h-8 text-[#00FF9D] animate-pulse" />
        </div>
      </div>

      {/* Brand Heading & Boot State */}
      <div className="relative z-10 text-center max-w-md px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#13231B] border border-[#00FF9D]/40 text-[#00FF9D] text-[11px] font-mono tracking-widest uppercase mb-3 shadow-[0_0_15px_rgba(0,255,157,0.25)]">
          <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-ping" />
          ZeroWaste AI // Autonomous Core
        </div>

        <h1 className="text-2xl font-black text-[#F0FAF4] tracking-tight">
          Booting Perishable Intelligence
        </h1>

        <p className="text-xs text-[#00F0FF] mt-2 font-mono h-5 truncate transition-all duration-200">
          {BOOT_STEPS[stepIndex]}
        </p>

        {/* High-Tech Progress Meter */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#A3C5B3]">System Initialized</span>
            <span className="text-[#00FF9D] font-bold">{progress}%</span>
          </div>

          <div className="w-72 sm:w-80 h-2 bg-[#13231B] rounded-full mx-auto overflow-hidden border border-[#243E30] relative p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#00F0FF] via-[#00FF9D] to-[#B026FF] rounded-full transition-all duration-150 relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/40 animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={() => setVisible(false)}
          className="mt-6 text-[11px] text-[#6B8E7B] hover:text-[#00FF9D] font-mono uppercase tracking-wider underline underline-offset-4 transition-colors"
        >
          Skip Boot Sequence &rarr;
        </button>
      </div>
    </div>
  );
};
