"use client";

import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../_lib/studio-api";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
          isUser
            ? "bg-zinc-800 text-zinc-100"
            : "bg-zinc-900 text-zinc-200"
        }`}
      >
        <div className="break-words text-sm leading-relaxed">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : isStreaming && !message.content ? (
            <span className="inline-flex gap-0.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
            </span>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-emerald-400 align-text-bottom" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
