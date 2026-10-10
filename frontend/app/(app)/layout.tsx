import { BottomNav, Sidebar, Topbar } from "@/components/nav";
import RouteTransition from "@/components/route-transition";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-3 pb-24 pt-1 sm:px-4 lg:pb-10">
        <Sidebar />
        <main className="min-w-0 flex-1 py-3">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      <BottomNav />
      <footer className="mx-auto hidden max-w-[1400px] px-4 pb-8 text-xs opacity-60 lg:block">
        Synthetic demo data (seed=42). ERP/WMS/POS are simulated. Every number comes from computed or stored data.
      </footer>
    </>
  );
}
