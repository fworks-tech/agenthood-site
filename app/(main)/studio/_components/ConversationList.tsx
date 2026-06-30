"use client";

import { useState } from "react";
import type { Conversation } from "../_hooks/useStudioChat";
import { agents } from "../_data/agents";
import type { AgentEntry } from "../_data/agents";

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
    <div className="border-b border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-2 hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-xs font-medium text-zinc-400">Conversations</span>
          <span className="text-[10px] text-zinc-600">{conversations.length}</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNewConversation(); }}
          className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
          title="New conversation"
        >
          + New
        </button>
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto border-t border-zinc-800/50">
          {sorted.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-zinc-600 italic">No conversations yet</p>
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
                  <span className="shrink-0 text-xs">{getAgentIcon(conv.agentId)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs text-zinc-300">{conv.title}</p>
                    <p className="text-[10px] text-zinc-600">
                      {conv.messages.length > 0 ? `${conv.messages.length} msgs · ` : ""}
                      {formatDate(conv.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                    title="Delete conversation"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
