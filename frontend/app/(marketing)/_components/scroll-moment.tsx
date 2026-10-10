"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView, useReducedMotion, useScroll } from "framer-motion";

const LazyScrollCanvas = dynamic(() => import("./scroll-canvas"), { ssr: false });

/** Scroll-driven illustration: camera glides, LEDs green -> amber -> red. */
export default function ScrollMoment() {
  const sectionRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { amount: 0.1 });
  const reduce = useReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        const c = document.createElement("canvas");
        const gl = window.WebGLRenderingContext ? (c.getContext("webgl") ?? c.getContext("experimental-webgl")) : null;
        setWebgl(gl !== null && window.innerWidth >= 768);
      } catch {
        setWebgl(false);
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  const showCanvas = webgl === true;
  return (
    <section ref={sectionRef} aria-label="Expiry risk illustration">
      <div ref={wrapRef} className="glass relative h-[70vh] min-h-[420px] overflow-hidden">
        <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-[11px] uppercase tracking-widest opacity-80">
          Illustration — not live data
        </div>
        {webgl === null && <div className="skeleton absolute inset-0" />}
        {(webgl === false || reduce) && (
          <div className="absolute inset-0 flex items-center justify-center gap-6 bg-gradient-to-br from-[#0B3D2E] via-[#0a2a20] to-[#111827]" aria-hidden>
            {(["#66E3A1", "#F4B860", "#FF7D78"] as const).map((c) => (
              <span key={c} className="inline-block h-10 w-10 rounded-full" style={{ background: c }} />
            ))}
          </div>
        )}
        {showCanvas && inView && (
          <Suspense fallback={<div className="skeleton absolute inset-0" />}>
            <LazyScrollCanvas progress={scrollYProgress} animated={!reduce} />
          </Suspense>
        )}
      </div>
      <p className="mt-2 text-xs opacity-60">As days pass without selling through, shelf LEDs shift from green to amber to red — the same bands the Spoilage Estimator computes per batch.</p>
    </section>
  );
}
