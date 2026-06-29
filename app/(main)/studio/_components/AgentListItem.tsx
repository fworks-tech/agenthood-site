"use client";

import type { AgentEntry } from "../_data/agents";

interface AgentListItemProps {
  agent: AgentEntry;
  isSelected: boolean;
  onSelect: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  engineering: "bg-blue-500",
  validation: "bg-amber-500",
  knowledge: "bg-purple-500",
  lifecycle: "bg-emerald-500",
};

export default function AgentListItem({ agent, isSelected, onSelect }: AgentListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
        isSelected
          ? "bg-zinc-700/60"
          : "hover:bg-zinc-800/50"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {agent.icon ? (
          <span className="shrink-0 text-base">{agent.icon}</span>
        ) : (
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              agent.enabled ? CATEGORY_COLORS[agent.category] || "bg-zinc-500" : "bg-zinc-600"
            }`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${
            isSelected ? "text-white" : "text-zinc-300"
          }`}>
            {agent.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{agent.role}</p>
        </div>
      </div>
    </button>
  );
}
