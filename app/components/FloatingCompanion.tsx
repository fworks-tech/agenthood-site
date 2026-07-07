"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const MAX_SESSION_MESSAGES = 20;
const MAX_INPUT_LENGTH = 500;

const QUICK_ACTIONS = [
  { label: "Test my knowledge", prompt: "Quiz me on this page content!" },
  { label: "Summarize this page", prompt: "Give me a summary of this page." },
  { label: "Leave feedback", prompt: "I have some feedback:" },
  { label: "Ask me anything", prompt: "" },
] as const;

let msgId = 0;
function nextId() {
  return `msg-${++msgId}`;
}

function ThinkingDot() {
  return (
    <span className="inline-flex items-center gap-1 ml-2 text-xs text-zinc-500">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "0ms" }} />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "150ms" }} />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "300ms" }} />
      <span className="ml-1">Thinking</span>
    </span>
  );
}

export function FloatingCompanion() {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const sessionLimitReached = userMsgCount >= MAX_SESSION_MESSAGES;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(role: "user" | "assistant", content: string) {
    setMessages((prev) => [...prev, { id: nextId(), role, content }]);
  }

  function handleQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
    if (sessionLimitReached) return;

    if (action.label === "Leave feedback") {
      setShowFeedback(true);
      return;
    }

    if (action.label === "Ask me anything") {
      inputRef.current?.focus();
      return;
    }

    addMessage("user", action.prompt);
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      const response = getAutoResponse(action.label);
      addMessage("assistant", response);
    }, 800);
  }

  function handleSendFeedback() {
    if (!feedbackText.trim() || sessionLimitReached) return;
    addMessage("user", `Feedback: ${feedbackText}`);
    setFeedbackText("");
    setShowFeedback(false);
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      addMessage("assistant", "Thanks for your feedback! It helps make Agenthood better.");
    }, 600);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isThinking || sessionLimitReached) return;
    const text = input.trim();
    setInput("");
    addMessage("user", text);
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      addMessage("assistant", "Great question! I'm here to help you learn about Agenthood. Try one of the quick actions above or check the docs for more details.");
    }, 700);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open assistant"
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/25 flex items-center justify-center text-2xl cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 ${isOpen ? "hidden" : ""}`}
        style={{ animation: "float 3s ease-in-out infinite" }}
      >
        🤓
      </button>

      {isOpen && (
        <div
          data-companion-overlay
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`fixed z-50 bottom-6 right-6 transition-all duration-300 ease-out ${isOpen ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-4 scale-95 pointer-events-none"}`}
        style={{ animation: isOpen ? "slide-up 0.3s ease-out" : "none" }}
      >
        <div
          className={`bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${expanded ? "w-[600px] h-[600px]" : "w-96 max-h-[520px]"}`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤓</span>
              <span className="text-sm font-medium text-white">The Oracle</span>
              {isThinking && <ThinkingDot />}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={expanded ? "Minimize" : "Expand"}
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {expanded ? (
                    <>
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="14" y1="10" x2="21" y2="3" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  ) : (
                    <>
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  )}
                </svg>
              </button>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.length === 0 && !showFeedback && (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">🤓</div>
                <p className="text-white font-medium">Hi, I'm The Oracle!</p>
                <p className="text-zinc-400 text-sm">
                  I know everything about Agenthood. Ask me anything about the docs, members, or how things work.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      disabled={sessionLimitReached}
                      className="px-3 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showFeedback && (
              <div className="space-y-3 py-2">
                <p className="text-sm text-zinc-300">
                  What would you like to share? Your feedback helps us improve.
                </p>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                  placeholder="Write your feedback..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setShowFeedback(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600">{feedbackText.length}/{MAX_INPUT_LENGTH}</span>
                    <button
                      type="button"
                      onClick={handleSendFeedback}
                      disabled={!feedbackText.trim() || sessionLimitReached}
                      className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-emerald-600/20 text-emerald-200 border border-emerald-700/30"
                      : "bg-zinc-800 text-zinc-200 border border-zinc-700/50"
                  }`}
                >
                  <span className="text-xs font-medium block mb-0.5 opacity-60">
                    {msg.role === "user" ? "You" : "Oracle"}
                  </span>
                  {msg.content}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 border border-zinc-700/50 rounded-lg px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {sessionLimitReached ? (
            <div className="px-4 py-3 text-center text-xs text-zinc-500 border-t border-zinc-800 shrink-0">
              Conversation limit reached. Refresh to start a new one.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-zinc-800 shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    rows={1}
                    disabled={isThinking}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-14 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                  <span className={`absolute right-2 bottom-2 text-xs ${input.length >= MAX_INPUT_LENGTH ? "text-red-400" : "text-zinc-600"}`}>
                    {input.length}/{MAX_INPUT_LENGTH}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label="Send message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function getAutoResponse(action: string): string {
  const responses: Record<string, string> = {
    "Test my knowledge": "Sure! Let me quiz you. What's the purpose of a skill file in Agenthood? A) To store compiled code B) To describe an agent's role, responsibilities, and communication rules C) To replace package.json",
    "Summarize this page": "This page covers the Agenthood Society members, how to load them into your runtime, and how to invoke them via the autonomous CLI. Each member has a specific specialty — from code review (The Reviewer) to security (The Auditor) to releases (The Herald).",
  };
  return responses[action] || "I'm here to help you learn about Agenthood. Try the quick actions or ask me a specific question!";
}
