"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView } from "framer-motion";

const LazyHeroCanvas = dynamic(() => import("./hero-canvas"), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0" />,
});

function HeroFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B3D2E] via-[#0a2a20] to-[#111827]" />
      <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
        <rect x="180" y="150" width="440" height="150" rx="10" fill="none" stroke="#66E3A1" strokeWidth="2" opacity="0.7" />
        <circle cx="300" cy="225" r="16" fill="#66E3A1" opacity="0.8" />
        <circle cx="400" cy="225" r="16" fill="#F4B860" opacity="0.8" />
        <circle cx="500" cy="225" r="16" fill="#FF7D78" opacity="0.8" />
      </svg>
    </div>
  );
}

/** Decides canvas vs static fallback (mobile / reduced motion / no WebGL). */
export default function HeroVisual({ animated = true }: { animated?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { amount: 0.15 });
  const [mode, setMode] = useState<"loading" | "canvas" | "fallback">("loading");
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        const c = document.createElement("canvas");
        const gl = window.WebGLRenderingContext ? (c.getContext("webgl") ?? c.getContext("experimental-webgl")) : null;
        const ok =
          gl !== null &&
          window.innerWidth >= 768 &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setMode(ok ? "canvas" : "fallback");
      } catch {
        setMode("fallback");
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  return (
    <div ref={wrapRef} className="absolute inset-0">
      {mode === "loading" && <div className="skeleton absolute inset-0" />}
      {mode === "fallback" && <HeroFallback />}
      {mode === "canvas" && (
        <Suspense fallback={<div className="skeleton absolute inset-0" />}>
          <LazyHeroCanvas animated={animated} paused={!inView} />
        </Suspense>
      )}
    </div>
  );
}
