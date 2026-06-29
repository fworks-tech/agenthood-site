"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import type { ChatMessage } from "../_lib/studio-api";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Send a message to start the conversation.</p>
      </div>
    );
  }

  const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === "assistant");
  const streamingIndex = lastAssistantIndex >= 0 ? messages.length - 1 - lastAssistantIndex : -1;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === streamingIndex}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
