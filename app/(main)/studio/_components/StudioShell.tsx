"use client";

import { useState } from "react";
import AgentSidebar from "./AgentSidebar";
import type { AgentEntry } from "../_data/agents";

interface StudioShellProps {
  agents: AgentEntry[];
  selectedAgent: AgentEntry | null;
  onSelectAgent: (agent: AgentEntry) => void;
  isLoading: boolean;
  children: React.ReactNode;
}

export default function StudioShell({
  agents,
  selectedAgent,
  onSelectAgent,
  isLoading,
  children,
}: StudioShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[calc(100vh-57px)] bg-zinc-950">
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 w-64 border border-zinc-800 bg-zinc-900 transition-transform md:relative md:translate-x-0`}
      >
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          onSelect={(agent) => {
            onSelectAgent(agent);
            setSidebarOpen(false);
          }}
          isLoading={isLoading}
        />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {selectedAgent && (
            <span className="text-sm text-zinc-300 font-medium truncate">
              {selectedAgent.name}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
