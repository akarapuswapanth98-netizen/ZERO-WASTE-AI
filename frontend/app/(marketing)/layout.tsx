import Link from "next/link";
import { ThemeToggle } from "@/components/nav";
import RouteTransition from "@/components/route-transition";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 p-3">
        <div className="glass mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ZeroWaste AI home">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-900 text-[#0B3D2E]" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 6c3 2 4 5 3 8-3 1-6 0-8-3 2 0 3-1 4-2-1-1-1-2 1-3z" fill="currentColor" />
              </svg>
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight">ZeroWaste AI</span>
          </Link>
          <span className="ml-auto" />
          <ThemeToggle />
          <Link href="/overview" className="btn btn-primary px-4 py-2 text-sm">Enter app</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-3 sm:px-4">
        <RouteTransition>{children}</RouteTransition>
      </main>
      <footer className="mx-auto max-w-[1400px] px-4 py-10 text-center text-xs opacity-60">
        Team RISING SUNS - GDGoC HITAM Agentic AI Hackathon
      </footer>
    </>
  );
}
