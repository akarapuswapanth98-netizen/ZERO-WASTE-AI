"use client";

import React from "react";
import { Sparkles, Bot, ShieldCheck, Cpu } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080F0C]/95 backdrop-blur-2xl">
      {/* Background Cyber Mesh */}
      <div className="absolute inset-0 vibe-grid opacity-30 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#00F0FF]/10 via-[#00FF9D]/15 to-[#B026FF]/10 blur-3xl pointer-events-none animate-pulseSlow" />

      {/* 3D Gyroscope Hologram Loader */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Outer Cyan Ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00F0FF] animate-[spin_8s_linear_infinite] shadow-[0_0_20px_rgba(0,240,255,0.4)]" />
        
        {/* Middle Violet Counter-Rotating Ring */}
        <div className="absolute inset-3 rounded-full border-2 border-dotted border-[#B026FF] animate-[spin_5s_linear_infinite_reverse] shadow-[0_0_20px_rgba(176,38,255,0.4)]" />
        
        {/* Inner Emerald Fast Ring */}
        <div className="absolute inset-6 rounded-full border-2 border-solid border-[#00FF9D]/60 animate-[spin_3s_linear_infinite] shadow-[0_0_15px_rgba(0,255,157,0.5)]" />

        {/* Center Quantum AI Core */}
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#13231B] to-[#080F0C] border border-[#00FF9D] flex items-center justify-center shadow-[0_0_25px_rgba(0,255,157,0.6)] animate-pulse">
          <Bot className="w-7 h-7 text-[#00FF9D]" />
        </div>
      </div>

      {/* Futuristic Telemetry Status */}
      <div className="relative z-10 mt-8 text-center max-w-sm px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#13231B] border border-[#00FF9D]/40 text-[#00FF9D] text-[11px] font-mono tracking-widest uppercase mb-3 shadow-[0_0_15px_rgba(0,255,157,0.25)]">
          <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-ping" />
          Quantum ZeroWaste Core
        </div>
        <h2 className="text-lg font-extrabold text-[#F0FAF4] tracking-tight">
          Calibrating Agentic Inventory State
        </h2>
        <p className="text-xs text-[#A3C5B3] mt-1 font-mono">
          Synchronizing 5-store network demand models &amp; FIFO batches...
        </p>

        {/* Progress Bar with Moving Laser Line */}
        <div className="w-64 h-1.5 bg-[#13231B] rounded-full mx-auto mt-5 overflow-hidden border border-[#243E30] relative">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00F0FF] via-[#00FF9D] to-[#B026FF] w-full rounded-full animate-pulse" />
          <div className="absolute inset-y-0 w-12 bg-white/70 blur-[2px] animate-shimmer" />
        </div>

        {/* System Diagnostics Ticker */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[10px] font-mono text-[#6B8E7B]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#00FF9D]" /> DB: Connected
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-[#00F0FF]" /> 5 Agents Deliberating
          </span>
        </div>
      </div>
    </div>
  );
}
