"use client";

import { UnstyledButton, Group, Text } from "@mantine/core";
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
    <UnstyledButton
      onClick={onSelect}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
        isSelected
          ? "bg-zinc-700/60"
          : "hover:bg-zinc-800/50"
      }`}
    >
      <Group gap="sm" wrap="nowrap">
        {agent.icon ? (
          <Text className="shrink-0 text-base">{agent.icon}</Text>
        ) : (
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              agent.enabled ? CATEGORY_COLORS[agent.category] || "bg-zinc-500" : "bg-zinc-600"
            }`}
          />
        )}
        <div className="min-w-0 flex-1">
          <Text size="sm" fw={500} truncate c={isSelected ? "white" : "zinc.3"}>
            {agent.name}
          </Text>
          <Text size="xs" c="zinc.5" truncate>
            {agent.role}
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  );
}
