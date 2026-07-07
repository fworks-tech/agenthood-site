"use client";

import { useEffect, useRef } from "react";
import { ScrollArea, Stack, Text, Group } from "@mantine/core";
import MessageBubble from "./MessageBubble";
import type { ChatMessage } from "../_lib/studio-api";
import HelpTip from "./HelpTip";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  conversationId?: string;
}

export default function MessageList({ messages, isStreaming, conversationId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <Group className="flex-1" justify="center" align="center">
        <Text size="sm" c="zinc.5" className="flex items-center gap-1">
          Send a message to start the conversation.
          <HelpTip text="This area displays the chat conversation. Select an agent and type a message to begin." />
        </Text>
      </Group>
    );
  }

  const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === "assistant");
  const streamingIndex = lastAssistantIndex >= 0 ? messages.length - 1 - lastAssistantIndex : -1;

  return (
    <ScrollArea className="flex-1" px="lg" py="xl">
      <Stack className="mx-auto max-w-3xl" gap="md">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === streamingIndex}
            conversationId={conversationId}
          />
        ))}
        <div ref={bottomRef} />
      </Stack>
    </ScrollArea>
  );
}
