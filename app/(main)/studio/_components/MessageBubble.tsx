"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Paper, Text, ActionIcon, Group, Typography, Title, Collapse } from "@mantine/core";
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
  onReplayTool?: (messageId: string, toolCallId: string) => void;
}

export default function MessageBubble({ message, isStreaming, conversationId, onReplayTool }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

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

  function renderToolStatusIcon(status: string) {
  if (status === "complete") {
    return (
      <svg className="h-3 w-3 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg className="h-3 w-3 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
  );
}

  const mdComponents: Components = {
    pre: ({ children }) => (
      <pre className="my-2 max-w-full overflow-x-auto rounded bg-zinc-950/70 p-2 text-xs leading-relaxed">
        {children}
      </pre>
    ),
    h1: ({ children }) => (
      <Title order={3} size="sm" fw={600} mt="sm" mb={4}>{children}</Title>
    ),
    h2: ({ children }) => (
      <Title order={4} size="sm" fw={600} mt="sm" mb={4}>{children}</Title>
    ),
    h3: ({ children }) => (
      <Title order={5} size="sm" fw={600} mt="sm" mb={4}>{children}</Title>
    ),
  };

  return (
    <div className="flex justify-start">
      <Paper bg="zinc.9" px="xl" py={10} className="max-w-[85%] md:max-w-[75%]">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls.map((tc) => {
              const isOpen = !!expandedTools[tc.id];
              return (
                <div
                  key={tc.id}
                  className={`rounded border px-2 py-1 text-xs transition-colors duration-200 ${
                    tc.status === "complete"
                      ? "border-emerald-800/40 bg-emerald-950/20"
                      : tc.status === "error"
                        ? "border-red-800/40 bg-red-950/20"
                        : "border-zinc-700 bg-zinc-800/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedTools((s) => ({ ...s, [tc.id]: !isOpen }))}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    {renderToolStatusIcon(tc.status)}
                    <span className="font-medium text-zinc-200">{tc.name}</span>
                    {tc.durationMs !== undefined && (
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                        {(tc.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    {tc.status === "complete" && tc.result && (
                      <span className="truncate text-zinc-500">{tc.result.slice(0, 60)}</span>
                    )}
                    {tc.status === "error" && (
                      <span className="truncate text-red-400">{tc.error?.slice(0, 60)}</span>
                    )}
                    <span
                      className={`ml-auto shrink-0 text-zinc-500 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>
                  <Collapse expanded={isOpen}>
                    <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-zinc-500">args</div>
                        <pre className="mt-1 overflow-x-auto rounded bg-zinc-950/70 p-2 text-[11px] leading-relaxed">
                          {JSON.stringify(tc.args, null, 2)}
                        </pre>
                      </div>
                      {tc.result && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-emerald-400">result</div>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-950/70 p-2 text-[11px] text-zinc-300">
                            {tc.result}
                          </pre>
                        </div>
                      )}
                      {tc.error && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-red-400">error</div>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-zinc-950/70 p-2 text-[11px] text-red-300">
                            {tc.error}
                          </pre>
                        </div>
                      )}
                      {tc.status === "error" && onReplayTool && (
                        <button
                          type="button"
                          onClick={() => onReplayTool(message.id, tc.id)}
                          className="rounded border border-red-800/50 bg-red-950/30 px-2 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-950/60"
                        >
                          Retry tool
                        </button>
                      )}
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        )}
        <Typography className="break-words">
          <ReactMarkdown components={mdComponents}>{message.content}</ReactMarkdown>
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
              className="active:scale-125 transition-all duration-150"
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
              className="active:scale-125 transition-all duration-150"
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
