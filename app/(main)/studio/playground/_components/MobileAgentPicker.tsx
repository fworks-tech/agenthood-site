'use client';

import { Select, Skeleton, Text } from '@mantine/core';
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
        <Skeleton height={38} radius="md" aria-label="Loading agents" />
      ) : error ? (
        <div className="flex items-center gap-1 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400">
          Failed to load agents
          <HelpTip text="Could not load the agent list. Try again or check your connection." />
        </div>
      ) : (
        <>
          <Text component="label" htmlFor="mobile-agent-picker" size="xs" c="dimmed" mb={4} className="sr-only">
            Select an agent
          </Text>
          <Select
            id="mobile-agent-picker"
            aria-label="Select an agent"
            placeholder="Select an agent..."
            value={null}
            searchable
            nothingFoundMessage="No agents found"
            data={agents.map((agent) => ({
              value: agent.id,
              label: `${agent.icon ?? ''} ${agent.name} — ${agent.role}`,
            }))}
            onChange={(value) => {
              const agent = agents.find((a) => a.id === value);
              if (agent) onSelect(agent);
            }}
          />
        </>
      )}
    </div>
  );
}
