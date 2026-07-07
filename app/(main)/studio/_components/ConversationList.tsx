"use client";

import { useState } from "react";
import { ScrollArea, Group, Text, ActionIcon, Collapse, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconTrash } from "@tabler/icons-react";
import type { Conversation } from "../_hooks/useStudioChat";
import { agents } from "../_data/agents";
import type { AgentEntry } from "../_data/agents";
import HelpTip from "./HelpTip";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
}

function getAgentIcon(agentId: string): string {
  return agents.find((a: AgentEntry) => a.id === agentId)?.icon ?? "💬";
}

function formatDate(ts: number): string {
  const delta = Date.now() - ts;
  if (delta < 60000) return "now";
  if (delta < 3600000) return `${Math.floor(delta / 60000)}m`;
  if (delta < 86400000) return `${Math.floor(delta / 3600000)}h`;
  if (delta < 604800000) return `${Math.floor(delta / 86400000)}d`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onNewConversation,
  onDelete,
}: ConversationListProps) {
  const [open, setOpen] = useState(true);

  const sorted = [...conversations].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="border border-zinc-800">
      <Group justify="space-between" px="lg" py="sm">
        <UnstyledButton
          onClick={() => setOpen((p) => !p)}
          className="hover:bg-zinc-900 transition-colors"
        >
          <Group gap="xs">
            <IconChevronDown
              size={14}
              className="text-zinc-500 transition-transform duration-200"
              style={{ transform: open ? undefined : "rotate(-90deg)" }}
            />
            <Text size="xs" fw={500} c="zinc.4" className="flex items-center gap-1">
              Conversations
              <HelpTip text="Your saved chat sessions, stored locally in your browser." side="bottom" />
            </Text>
            <Text size="xs" c="zinc.6">{conversations.length}</Text>
          </Group>
        </UnstyledButton>
        <Group gap="xs">
          <UnstyledButton
            onClick={onNewConversation}
            className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
            title="New conversation"
          >
            + New
          </UnstyledButton>
          <HelpTip text="Starts a fresh conversation. Previous conversations are preserved." side="left" />
        </Group>
      </Group>

      <Collapse expanded={open}>
        <ScrollArea h={192} className="border-t border-zinc-800/50">
          {sorted.length === 0 ? (
            <Group px="lg" py="md" gap="xs">
              <Text size="xs" c="zinc.6" fs="italic">
                No conversations yet
              </Text>
              <HelpTip text="Conversations appear here once you send a message to an agent." />
            </Group>
          ) : (
            sorted.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-emerald-950/30 border-l-2 border-emerald-500"
                      : "border-l-2 border-transparent hover:bg-zinc-900"
                  }`}
                  onClick={() => onSelect(conv.id)}
                >
                  <Text className="shrink-0 text-xs">{getAgentIcon(conv.agentId)}</Text>
                  <div className="flex-1 min-w-0">
                    <Text size="xs" truncate c="zinc.3">{conv.title}</Text>
                    <Text size="xs" c="zinc.6">
                      {conv.messages.length > 0 ? `${conv.messages.length} msgs · ` : ""}
                      {formatDate(conv.createdAt)}
                    </Text>
                  </div>
                  <Group gap={4}>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      c="zinc.6"
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                      title="Delete conversation"
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                    <HelpTip text="Permanently removes this conversation and its messages from local storage." side="left" />
                  </Group>
                </div>
              );
            })
          )}
        </ScrollArea>
      </Collapse>
    </div>
  );
}
