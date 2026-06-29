"use client";

import { useState, useRef, useEffect } from "react";

interface ChatComposerProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export default function ChatComposer({ onSend, onStop, isStreaming, disabled }: ChatComposerProps) {
  const [input, setInput] = useState("");
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const warningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const showWarning = (msg: string) => {
    setImageWarning(msg);
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    warningTimeout.current = setTimeout(() => setImageWarning(null), 5000);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        showWarning("This model does not support image input. Text only.");
        return;
      }
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
      {imageWarning && (
        <div className="mx-auto mb-2 max-w-3xl rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">
          {imageWarning}
        </div>
      )}
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Type a message..."
          rows={1}
          disabled={isStreaming || disabled}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors"
            aria-label="Stop streaming"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
