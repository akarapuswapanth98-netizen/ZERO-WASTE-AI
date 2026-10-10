"use client";
import { motion, useReducedMotion } from "framer-motion";

const FEATURES: Array<[string, string]> = [
  ["Forecast with uncertainty", "Per-series best of seasonal-naive, moving average and SES on a held-out week, with 80% bands."],
  ["Spoilage risk with reasons", "Low / Medium / High bands with ranges and plain-language reasons per batch."],
  ["Markdown, donate, transfer, replenish", "Every option scored by expected loss behind safety guards; markdown never fires without at-risk stock."],
  ["Planner approval + audit trail", "One proposal per store and SKU; humans approve, everything is logged."],
  ["3D shelf explorer + time-travel", "Risk-coloured shelves recomputed by the backend engine up to 7 days ahead."],
  ["Scenarios vs baselines", "Identical demand and seeds for agentic, FIFO and fixed-threshold policies, reported honestly."],
];

export default function Features() {
  const reduce = useReducedMotion();
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold">Everything in the box</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([name, blurb], i) => (
          <motion.div
            key={name}
            className="glass feature-card p-4"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.35, delay: (i % 3) * 0.07 }}
            whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.15 } }}
          >
            <p className="font-bold">{name}</p>
            <p className="mt-1 text-sm opacity-70">{blurb}</p>
          </motion.div>
        ))}
      </div>
      <style>{`.feature-card{transition:box-shadow .2s ease}.feature-card:hover{box-shadow:0 0 26px rgba(102,227,161,.35)}`}</style>
    </div>
  );
}
