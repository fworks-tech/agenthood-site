"use client";

import { useState } from "react";
import AgentListItem from "./AgentListItem";
import type { AgentEntry } from "../_data/agents";

interface AgentSidebarProps {
  agents: AgentEntry[];
  selectedAgent: AgentEntry | null;
  onSelect: (agent: AgentEntry) => void;
  isLoading: boolean;
}

const CATEGORIES: Record<string, string> = {
  engineering: "Engineering",
  validation: "Validation",
  knowledge: "Knowledge",
  lifecycle: "Lifecycle",
};

export default function AgentSidebar({ agents, selectedAgent, onSelect, isLoading }: AgentSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.shortDescription.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped: Record<string, AgentEntry[]> = {};
  for (const agent of filtered) {
    const cat = agent.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(agent);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-4">
        <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Society Members</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Select an agent to start chatting</p>
      </div>

      <div className="px-4 py-3">
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="space-y-2 px-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-zinc-800" />
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="px-4 pt-4 text-sm text-zinc-500">No agents match your search.</p>
        ) : (
          Object.entries(grouped).map(([category, categoryAgents]) => (
            <div key={category} className="pt-3 first:pt-0">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                {CATEGORIES[category] || category}
              </p>
              {categoryAgents.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent?.id === agent.id}
                  onSelect={() => onSelect(agent)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
