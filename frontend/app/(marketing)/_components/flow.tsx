"use client";
import { motion, useReducedMotion } from "framer-motion";

const STEPS: Array<[string, string]> = [
  ["Demand Forecaster", "Predicts units per day from sales history, with honest held-out error."],
  ["Spoilage Estimator", "Burns batches down first-expiry-first against the forecast to get at-risk units."],
  ["Stock Analyst", "Finds overstock, shortages and store-to-store transfer pairs."],
  ["Options Pricer", "Scores markdown, donate, transfer, replenish and no-action by expected loss, behind safety guards."],
  ["Coordinator", "Validates every output, enforces the rules and picks exactly one proposal per store and SKU."],
];

export default function Flow() {
  const reduce = useReducedMotion();
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold">How it works</h2>
      <ol className="mt-3 flex flex-col gap-1">
        {STEPS.map(([name, blurb], i) => (
          <motion.li
            key={name}
            className="flex items-stretch gap-3"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            <div className="flex flex-col items-center" aria-hidden>
              <span className="glass flex h-8 w-8 items-center justify-center text-sm font-bold">{i + 1}</span>
              {i < STEPS.length - 1 && <span className="flow-line w-0.5 flex-1 bg-emerald-500/50" />}
              {i === STEPS.length - 1 && <span className="w-0.5 flex-1" />}
            </div>
            <div className="glass mb-3 flex-1 p-3">
              <p className="font-bold">{name}</p>
              <p className="text-sm opacity-70">{blurb}</p>
            </div>
          </motion.li>
        ))}
        {[
          ["Planner approves", "Nothing executes without a human decision. Rejected proposals can never run."],
          ["Simulated execution + audit", "Approved actions run inside the simulation with stock re-checks; every step is audit-logged."],
        ].map(([name, blurb], i) => (
          <motion.li
            key={name}
            className="flex items-stretch gap-3"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.35, delay: (STEPS.length + i) * 0.06 }}
          >
            <div className="flex flex-col items-center" aria-hidden>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/30 text-sm font-bold">✓</span>
              {i === 0 && <span className="flow-line w-0.5 flex-1 bg-emerald-500/50" />}
            </div>
            <div className="glass mb-3 flex-1 p-3">
              <p className="font-bold">{name}</p>
              <p className="text-sm opacity-70">{blurb}</p>
            </div>
          </motion.li>
        ))}
      </ol>
      <style>{`.flow-line{background-image:linear-gradient(#10B981 55%,transparent 45%);background-size:2px 12px;animation:flowdash 1s linear infinite}@keyframes flowdash{to{background-position:0 12px}}`}</style>
    </div>
  );
}
