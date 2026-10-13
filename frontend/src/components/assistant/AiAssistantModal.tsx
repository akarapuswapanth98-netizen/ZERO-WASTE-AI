"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  X,
  Send,
  Sparkles,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Store,
  Calendar,
  Leaf,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { api, AssistantPrompt, AssistantResponse } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  intent?: string;
  suggestedActions?: { label: string; href: string }[];
  dataPoints?: Record<string, any>;
  source?: string;
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: "welcome-1",
  sender: "bot",
  text: "Hello! I am **ZeroWaste Copilot**, your real-time agentic inventory assistant.\n\nI monitor all perishable batches, expiration horizons, coordinator proposals, and carbon diversion metrics across your grocery network.\n\nHow can I help optimize your inventory today?",
  timestamp: "Just now",
  intent: "welcome",
  suggestedActions: [
    { label: "Check 48h Expirations", href: "/inventory" },
    { label: "Review Pending Proposals", href: "/planner" },
  ],
  source: "Deterministic Inventory Engine",
};

export const AiAssistantModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<AssistantPrompt[]>([
    { label: "Expiring in 48h", prompt: "What items are expiring in the next 48 hours?" },
    { label: "Pending Proposals", prompt: "Summarize pending coordinator recommendations" },
    { label: "Carbon Savings", prompt: "How much food waste and CO2e have we saved?" },
    { label: "Store Imbalances", prompt: "Which stores currently have inventory imbalances?" },
  ]);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load quick prompts from backend
  useEffect(() => {
    api
      .getAssistantPrompts()
      .then((data) => {
        if (data.prompts && data.prompts.length > 0) {
          setPrompts(data.prompts);
        }
      })
      .catch(() => {
        // Fallback prompts already initialized
      });
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText("");
    setLoading(true);

    try {
      const res: AssistantResponse = await api.sendAssistantMessage(query);
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        intent: res.intent,
        suggestedActions: res.suggested_actions,
        dataPoints: res.data_points,
        source: res.source,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: "Apologies, I encountered an issue querying the inventory engine. Please verify the backend connection.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        intent: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
  };

  // Render markdown-like bold and bullet formatting
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("• ")) {
        const content = line.substring(2);
        return (
          <li key={i} className="ml-3 list-disc my-1 leading-relaxed text-[#D6E6DC]">
            <span dangerouslySetInnerHTML={{ __html: formatBold(content) }} />
          </li>
        );
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <h4 key={i} className="font-semibold text-[#66E3A1] mt-2 mb-1">
            {line.replace(/\*\*/g, "")}
          </h4>
        );
      }
      if (!line.trim()) {
        return <div key={i} className="h-2" />;
      }
      return (
        <p key={i} className="my-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
      );
    });
  };

  const formatBold = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#66E3A1]">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-[#A3C2B0]">$1</em>');
  };

  return (
    <>
      {/* Floating Launcher Pill / Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            id="open-ai-bot-btn"
            className="group relative flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-[#172A20] via-[#1A3326] to-[#101D16] border border-[#66E3A1]/40 shadow-[0_4px_24px_rgba(102,227,161,0.25)] hover:shadow-[0_4px_30px_rgba(102,227,161,0.45)] hover:border-[#66E3A1] transition-all duration-300 hover:scale-105 active:scale-95"
            aria-label="Open ZeroWaste AI Assistant"
          >
            {/* Pulsing indicator dot */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#66E3A1] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#66E3A1]"></span>
            </span>

            {/* Bot Icon */}
            <div className="w-7 h-7 rounded-full bg-[#66E3A1]/20 border border-[#66E3A1]/40 flex items-center justify-center text-[#66E3A1]">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-[#E8F2EC] group-hover:text-[#66E3A1] transition-colors leading-tight">
                ZeroWaste Copilot
              </div>
              <div className="text-[10px] text-[#A3C2B0] font-mono leading-none">AI Inventory Bot</div>
            </div>

            <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#66E3A1]/15 text-[#66E3A1] px-2 py-0.5 rounded-full border border-[#66E3A1]/30">
              Live
            </span>
          </button>
        )}
      </div>

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div
          id="ai-bot-modal"
          className={`fixed right-4 md:right-6 bottom-4 md:bottom-6 z-50 flex flex-col bg-[#101D16]/95 backdrop-blur-2xl border border-[#2A4033] shadow-[0_12px_48px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden transition-all duration-300 ${
            isExpanded
              ? "w-[95vw] md:w-[700px] h-[88vh] max-h-[850px]"
              : "w-[92vw] sm:w-[440px] h-[82vh] max-h-[640px]"
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-[#172A20] via-[#101D16] to-[#101D16] border-b border-[#2A4033] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#66E3A1] to-[#1C3A2A] flex items-center justify-center p-1.5 shadow-[0_0_12px_rgba(102,227,161,0.3)]">
                <Bot className="w-5 h-5 text-[#0B1511]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#E8F2EC]">ZeroWaste Copilot</h3>
                  <span className="flex items-center gap-1 text-[10px] bg-[#1C3A2A] text-[#66E3A1] px-1.5 py-0.5 rounded-full border border-[#66E3A1]/30">
                    <ShieldCheck className="w-3 h-3 text-[#66E3A1]" /> Grounded DB
                  </span>
                </div>
                <p className="text-[11px] text-[#A3C2B0]">Perishable demand & risk assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Reset conversation"
                className="p-1.5 text-[#A3C2B0] hover:text-[#E8F2EC] hover:bg-[#172A20] rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse" : "Expand"}
                className="hidden sm:inline-flex p-1.5 text-[#A3C2B0] hover:text-[#E8F2EC] hover:bg-[#172A20] rounded-lg transition-colors"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 text-[#A3C2B0] hover:text-[#FF6B6B] hover:bg-[#172A20] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Verification Notice Banner */}
          <div className="px-3.5 py-1.5 bg-[#172A20]/80 border-b border-[#2A4033]/60 flex items-center justify-between text-[11px] text-[#A3C2B0]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#66E3A1]" />
              <span>Zero-hallucination: numbers computed from live stock & sales.</span>
            </span>
            <span className="font-mono text-[10px] text-[#66E3A1]">5 Stores • 18 SKUs</span>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3.5 py-2 border-b border-[#2A4033]/40 bg-[#0E1813]/60 overflow-x-auto no-scrollbar flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#A3C2B0] shrink-0">
              Quick:
            </span>
            {prompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.prompt)}
                disabled={loading}
                className="shrink-0 text-[11px] font-medium bg-[#172A20] hover:bg-[#1F382B] text-[#D6E6DC] hover:text-[#66E3A1] border border-[#2A4033] hover:border-[#66E3A1]/40 px-2.5 py-1 rounded-full transition-all active:scale-95 disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 shadow-md ${
                    msg.sender === "user"
                      ? "bg-[#1C3A2A] text-[#E8F2EC] border border-[#66E3A1]/30 rounded-tr-none"
                      : "bg-[#172A20] text-[#E8F2EC] border border-[#2A4033] rounded-tl-none"
                  }`}
                >
                  {/* Sender Header */}
                  {msg.sender === "bot" && (
                    <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-[#2A4033]/60">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#66E3A1]">
                        <Bot className="w-3 h-3" />
                        <span>ZeroWaste Copilot</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#A3C2B0]">{msg.timestamp}</span>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="text-[12px] leading-relaxed">
                    {msg.sender === "bot" ? renderFormattedText(msg.text) : msg.text}
                  </div>

                  {/* Suggested Actions Chips */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#2A4033]/60 flex flex-wrap gap-1.5">
                      {msg.suggestedActions.map((action, aIdx) => (
                        <Link
                          key={aIdx}
                          href={action.href}
                          onClick={() => {
                            if (window.innerWidth < 640) setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#101D16] hover:bg-[#1C3A2A] text-[#66E3A1] border border-[#66E3A1]/30 hover:border-[#66E3A1] px-2.5 py-1 rounded-lg transition-colors group"
                        >
                          <span>{action.label}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Source Stamp */}
                  {msg.source && (
                    <div className="mt-2 text-[9px] text-[#A3C2B0]/80 font-mono text-right">
                      Source: {msg.source}
                    </div>
                  )}
                </div>

                {/* User Timestamp */}
                {msg.sender === "user" && (
                  <span className="text-[10px] font-mono text-[#A3C2B0] mt-1 mr-1">{msg.timestamp}</span>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-[#66E3A1] bg-[#172A20] border border-[#2A4033] p-3 rounded-2xl rounded-tl-none w-36">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px] font-medium">Analyzing stock...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-[#101D16] border-t border-[#2A4033]">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                id="ai-bot-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about 48h expiry, markdowns, carbon..."
                disabled={loading}
                className="w-full bg-[#172A20] text-[#E8F2EC] placeholder-[#A3C2B0]/60 text-xs rounded-xl pl-3.5 pr-10 py-2.5 border border-[#2A4033] focus:border-[#66E3A1] focus:ring-1 focus:ring-[#66E3A1] focus:outline-none transition-all"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || loading}
                id="ai-bot-submit-btn"
                className="absolute right-1.5 p-1.5 rounded-lg bg-[#66E3A1] text-[#0B1511] hover:bg-[#7ff3b5] disabled:opacity-40 disabled:hover:bg-[#66E3A1] transition-all"
                title="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#A3C2B0] px-1 font-mono">
              <span>Press Enter to send</span>
              <span>ZeroWaste AI v1.0</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
