"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Paper, Text, ActionIcon, Group, Typography } from "@mantine/core";
import { IconThumbUp, IconThumbDown } from "@tabler/icons-react";
import type { ChatMessage } from "../_lib/studio-api";
import { STORAGE_KEYS } from "../_lib/constants";

function loadFeedback(): Record<string, "up" | "down"> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.FEEDBACK) ?? "{}");
  } catch {
    console.warn("Failed to load feedback from localStorage");
    return {};
  }
}

function saveFeedback(id: string, value: "up" | "down") {
  const fb = loadFeedback();
  fb[id] = value;
  localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(fb));
}

async function submitFeedback(messageId: string, value: "up" | "down" | null, conversationId?: string) {
  if (value) saveFeedback(messageId, value);
  try {
    await fetch("/api/studio/feedback/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, conversationId, value }),
    });
  } catch (err) {
    console.warn("Feedback submission failed", err);
  }
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  conversationId?: string;
}

export default function MessageBubble({ message, isStreaming, conversationId }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedback(loadFeedback()[message.id] ?? null);
  }, [message.id]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <Paper bg="zinc.8" px="xl" py={10} className="max-w-[85%] md:max-w-[75%]">
          <Text c="zinc.1" size="sm" className="break-words whitespace-pre-wrap leading-relaxed">
            {message.content}
          </Text>
        </Paper>
      </div>
    );
  }

  if (isStreaming && !message.content) {
    return (
      <div className="flex justify-start">
        <Paper bg="zinc.9" px="xl" py={10}>
          <span className="inline-flex gap-0.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
          </span>
        </Paper>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <Paper bg="zinc.9" px="xl" py={10} className="max-w-[85%] md:max-w-[75%]">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls.map((tc) => (
              <div
                key={tc.id}
                className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                  tc.status === "complete"
                    ? "bg-emerald-950/40 text-emerald-400"
                    : tc.status === "error"
                      ? "bg-red-950/40 text-red-400"
                      : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {tc.status === "complete" ? (
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : tc.status === "error" ? (
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span className="inline-block h-3 w-3 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                )}
                <span className="font-medium">{tc.name}</span>
                {tc.result && (
                  <span className="text-zinc-500 truncate max-w-[200px]">{tc.result.slice(0, 80)}{tc.result.length > 80 ? "..." : ""}</span>
                )}
                {tc.error && <span className="text-red-400 truncate">{tc.error.slice(0, 80)}</span>}
              </div>
            ))}
          </div>
        )}
        <Typography>
          <ReactMarkdown>{message.content}</ReactMarkdown>
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-emerald-400 align-text-bottom" />
          )}
        </Typography>
        {!isStreaming && (
          <Group gap="xs" mt="sm" pt="sm" className="border-t border-zinc-800">
            <ActionIcon
              variant="subtle"
              size="sm"
              color={feedback === "up" ? "emerald.4" : "zinc.6"}
              onClick={() => {
                const val = feedback === "up" ? null : "up";
                setFeedback(val);
                submitFeedback(message.id, val, conversationId);
              }}
              title="Helpful"
            >
              <IconThumbUp size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              color={feedback === "down" ? "red.4" : "zinc.6"}
              onClick={() => {
                const val = feedback === "down" ? null : "down";
                setFeedback(val);
                submitFeedback(message.id, val, conversationId);
              }}
              title="Not helpful"
            >
              <IconThumbDown size={14} />
            </ActionIcon>
          </Group>
        )}
      </Paper>
    </div>
  );
}
