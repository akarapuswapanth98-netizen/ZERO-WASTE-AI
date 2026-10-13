import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { AiAssistantModal } from "@/components/assistant/AiAssistantModal";
import { StartupLoader } from "@/components/layout/StartupLoader";
import { MouseGlowAura } from "@/components/layout/MouseGlowAura";

export const metadata: Metadata = {
  title: "ZeroWaste AI — Agentic Intelligence for Smarter Grocery Inventory",
  description:
    "Autonomous multi-agent system optimizing perishable demand forecasting, spoilage risk mitigation, and automated inventory interventions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080F0C] text-[#F0FAF4] min-h-screen antialiased selection:bg-[#00FF9D]/30 selection:text-[#00FF9D]">
        {/* Startup Boot Sequence */}
        <StartupLoader />

        {/* Interactive Mouse Ambient Glow */}
        <MouseGlowAura />

        <div className="flex min-h-screen">
          {/* Desktop Glass Sidebar */}
          <Sidebar />

          {/* Main Viewport Container */}
          <main className="flex-1 md:pl-64 flex flex-col min-h-screen pb-20 md:pb-8">
            {/* Top Bar on Mobile */}
            <header className="md:hidden flex items-center justify-between p-4 border-b border-[#2A4033] bg-[#101D16]/80 backdrop-blur-md sticky top-0 z-30">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#66E3A1] flex items-center justify-center">
                  <span className="text-[#0B1511] font-bold text-xs">ZW</span>
                </div>
                <span className="font-bold text-sm text-[#E8F2EC]">ZeroWaste AI</span>
              </div>
              <div className="text-[10px] bg-[#1C3A2A] text-[#66E3A1] px-2 py-0.5 rounded-full border border-[#66E3A1]/30 font-medium">
                Synthetic Demo
              </div>
            </header>

            {/* Page Body */}
            <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</div>
          </main>

          {/* AI Assistant Copilot Floating Bot */}
          <AiAssistantModal />

          {/* Mobile Bottom Navigation */}
          <MobileNav />
        </div>
      </body>
    </html>
  );
}
