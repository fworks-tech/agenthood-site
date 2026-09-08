'use client';

import HelpTip from '../../_components/HelpTip';
import type { AgentEntry } from '../../_data/agents';

interface MobileAgentPickerProps {
  agents: AgentEntry[];
  isLoading: boolean;
  error: string | null;
  onSelect: (agent: AgentEntry) => void;
}

export default function MobileAgentPicker({ agents, isLoading, error, onSelect }: MobileAgentPickerProps) {
  return (
    <div className="block border-t border-zinc-200 p-4 md:hidden dark:border-zinc-800">
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading agents...
          <HelpTip text="Fetching the agent directory from the server. This should take a moment." />
        </div>
      ) : error ? (
        <div className="flex items-center gap-1 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400">
          Failed to load agents
          <HelpTip text="Could not load the agent list. Try again or check your connection." />
        </div>
      ) : (
        <select
          value=""
          aria-label="Select an agent"
          onChange={(e) => {
            const agent = agents.find((a) => a.id === e.target.value);
            if (agent) onSelect(agent);
          }}
          className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-800 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="" disabled>
            Select an agent...
          </option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.icon ?? ''} {agent.name} — {agent.role}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
