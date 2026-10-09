import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { BottomNav, Sidebar, Topbar } from "@/components/nav";
import RouteTransition from "@/components/route-transition";

const inter = Inter({ variable: "--font-body", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZeroWaste AI — Agentic Intelligence for Smarter Grocery Inventory",
  description: "Forecast demand, estimate spoilage, approve one action per SKU/store. Synthetic demo (seed=42).",
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('zw-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${grotesk.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
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
      </body>
    </html>
  );
}
