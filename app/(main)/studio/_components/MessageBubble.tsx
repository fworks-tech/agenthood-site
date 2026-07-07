"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
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
        <div className="max-w-[85%] md:max-w-[75%] rounded-lg bg-zinc-800 px-4 py-2.5 text-zinc-100">
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  if (isStreaming && !message.content) {
    return (
      <div className="flex justify-start">
        <div className="rounded-lg bg-zinc-900 px-4 py-2.5">
          <span className="inline-flex gap-0.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] md:max-w-[75%] rounded-lg bg-zinc-900 px-4 py-2.5 text-zinc-200">
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
        <div className="prose prose-invert prose-sm max-w-none break-words prose-pre:overflow-x-auto prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700">
          <ReactMarkdown>{message.content}</ReactMarkdown>
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-emerald-400 align-text-bottom" />
          )}
        </div>
        {!isStreaming && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-800 pt-2">
            <button
              type="button"
              onClick={() => {
                const val = feedback === "up" ? null : "up";
                setFeedback(val);
                submitFeedback(message.id, val, conversationId);
              }}
              className={`rounded p-0.5 transition-colors ${
                feedback === "up" ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-400"
              }`}
              title="Helpful"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const val = feedback === "down" ? null : "down";
                setFeedback(val);
                submitFeedback(message.id, val, conversationId);
              }}
              className={`rounded p-0.5 transition-colors ${
                feedback === "down" ? "text-red-400" : "text-zinc-600 hover:text-zinc-400"
              }`}
              title="Not helpful"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
