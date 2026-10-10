import Link from "next/link";
import HeroVisual from "./_components/hero-scene";
import ScrollMoment from "./_components/scroll-moment";
import LiveStats from "./_components/live-stats";
import Flow from "./_components/flow";
import Features from "./_components/features";
import { GITHUB_URL, LIVE_URL } from "@/lib/site";

export default function Landing() {
  return (
    <div className="space-y-10 pb-10">
      {/* 1. Hero */}
      <section className="glass relative min-h-[86vh] overflow-hidden" aria-label="ZeroWaste AI introduction">
        <HeroVisual />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" aria-hidden />
        <div className="relative flex min-h-[86vh] max-w-2xl flex-col justify-center p-6 sm:p-10">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg sm:text-6xl">
            ZeroWaste AI
          </h1>
          <p className="font-display mt-3 text-xl text-emerald-100 sm:text-2xl">
            Agentic Intelligence for Smarter Grocery Inventory
          </p>
          <p className="mt-3 max-w-xl text-sm text-emerald-50/85 sm:text-base">
            Five agents forecast demand, estimate spoilage and price every option — then one proposal
            per store and SKU waits for a human to approve it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/overview" className="btn btn-primary px-6 py-3 text-sm">Enter app</Link>
            <a href="#how-it-works" className="btn btn-secondary px-6 py-3 text-sm !text-white">See how it works</a>
          </div>
        </div>
      </section>

      {/* 2. How it works */}
      <section id="how-it-works" aria-label="How it works" className="scroll-mt-24">
        <Flow />
      </section>

      {/* 3. Scroll moment */}
      <ScrollMoment />

      {/* 4. Live stats */}
      <section aria-label="Live demo statistics">
        <LiveStats />
      </section>

      {/* 5. Features */}
      <section aria-label="Features">
        <Features />
      </section>

      {/* 6. Honesty strip */}
      <section aria-label="Demo scope" className="glass p-4 text-center text-sm">
        <p><b>Demo Mode</b> — synthetic data · simulated POS/WMS/ERP · planner approval required.</p>
      </section>

      {/* 7. Final CTA */}
      <section className="glass p-8 text-center" aria-label="Get started">
        <h2 className="font-display text-2xl font-extrabold">See what expires next.</h2>
        <p className="mx-auto mt-1 max-w-md text-sm opacity-70">Open the dashboard, run the agents, and approve your first proposal.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/overview" className="btn btn-primary px-6 py-3 text-sm">Enter app</Link>
          {GITHUB_URL !== "" && <a href={GITHUB_URL} className="btn btn-secondary px-6 py-3 text-sm">GitHub</a>}
          {LIVE_URL !== "" && <a href={LIVE_URL} className="btn btn-secondary px-6 py-3 text-sm">Live demo</a>}
        </div>
      </section>
    </div>
  );
}
