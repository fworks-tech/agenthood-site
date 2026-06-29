"use client";

import { useEffect } from "react";
import MessageList from "./MessageList";
import ChatComposer from "./ChatComposer";
import { useStudioChat } from "../_hooks/useStudioChat";
import type { AgentEntry } from "../_data/agents";

interface ChatAreaProps {
  agent: AgentEntry;
}

export default function ChatArea({ agent }: ChatAreaProps) {
  const {
    conversations,
    activeConversationId,
    isStreaming,
    messages,
    sendMessage,
    abortStream,
    clearMessages,
    newConversation,
    switchConversation,
  } = useStudioChat();

  const hasConvForAgent = conversations.some((c) => c.agentId === agent.id);

  useEffect(() => {
    if (!hasConvForAgent) {
      newConversation(agent.id);
    } else if (!activeConversationId || !conversations.find((c) => c.id === activeConversationId)) {
      const existing = conversations.find((c) => c.agentId === agent.id);
      if (existing) switchConversation(existing.id);
    }
  }, [agent.id]);

  const agentConversations = conversations.filter((c) => c.agentId === agent.id);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
          <span className="text-xs text-zinc-500">• {agent.role}</span>
        </div>
        <div className="flex items-center gap-2">
          {agentConversations.length > 1 && (
            <select
              value={activeConversationId ?? ""}
              onChange={(e) => switchConversation(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 focus:border-emerald-500 focus:outline-none"
            >
              {agentConversations.map((c, i) => (
                <option key={c.id} value={c.id}>
                  Conversation {i + 1}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => newConversation(agent.id)}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            + New
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <MessageList messages={messages} isStreaming={isStreaming} />

      <ChatComposer
        onSend={sendMessage}
        onStop={abortStream}
        isStreaming={isStreaming}
      />
    </div>
  );
}
