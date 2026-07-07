"use client";

import { useState, useRef, useEffect } from "react";
import { ActionIcon, Textarea, Button, Paper, Text, Group, Stack, Overlay, ScrollArea } from "@mantine/core";
import { IconArrowsMaximize, IconArrowsMinimize, IconX, IconSend } from "@tabler/icons-react";

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

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full !p-0 !min-w-0`}
        style={{ animation: "float 3s ease-in-out infinite", display: isOpen ? "none" : "flex" }}
        aria-label="Open assistant"
      >
        <span className="text-2xl">🤓</span>
      </Button>

      {isOpen && (
        <Overlay color="#000" backgroundOpacity={0.5} blur={4} zIndex={40} onClick={() => setIsOpen(false)} />
      )}

      <Paper
        shadow="xl"
        radius="lg"
        className={`fixed z-50 bottom-6 right-6 transition-all duration-300 ease-out ${
          isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
        style={{ animation: isOpen ? "slide-up 0.3s ease-out" : "none" }}
        bg="dark.8"
        bd="1px solid var(--mantine-color-dark-4)"
      >
        <Paper
          className={`flex flex-col overflow-hidden ${expanded ? "w-[600px] h-[600px]" : "w-96 max-h-[520px]"}`}
          bg="dark.8"
        >
          <Group justify="space-between" px="md" py="sm" className="border-b border-zinc-800 shrink-0">
            <Group gap="sm">
              <Text size="lg">🤓</Text>
              <Text size="sm" fw={500} c="white">The Oracle</Text>
              {isThinking && <ThinkingDot />}
            </Group>
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setExpanded(!expanded)}
                aria-label={expanded ? "Minimize" : "Expand"}
              >
                {expanded ? <IconArrowsMinimize size={16} /> : <IconArrowsMaximize size={16} />}
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Group>

          <ScrollArea className="flex-1" p="md">
            <Stack gap="sm">
              {messages.length === 0 && !showFeedback && (
                <div className="text-center py-6 space-y-3">
                  <div className="text-4xl">🤓</div>
                  <Text c="white" fw={500}>Hi, I&apos;m The Oracle!</Text>
                  <Text c="dimmed" size="sm">
                    I know everything about Agenthood. Ask me anything about the docs, members, or how things work.
                  </Text>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {QUICK_ACTIONS.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        color="gray"
                        size="sm"
                        onClick={() => handleQuickAction(action)}
                        disabled={sessionLimitReached}
                        className="!text-zinc-300 hover:!border-emerald-500 hover:!text-emerald-400"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {showFeedback && (
                <div className="space-y-3 py-2">
                  <Text size="sm" c="gray.3">
                    What would you like to share? Your feedback helps us improve.
                  </Text>
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.currentTarget.value.slice(0, MAX_INPUT_LENGTH))}
                    placeholder="Write your feedback..."
                    minRows={3}
                    maxRows={6}
                  />
                  <Group justify="space-between">
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => setShowFeedback(false)}
                    >
                      Cancel
                    </Button>
                    <Group gap="sm">
                      <Text size="xs" c={feedbackText.length >= MAX_INPUT_LENGTH ? "red" : "dimmed"}>
                        {feedbackText.length}/{MAX_INPUT_LENGTH}
                      </Text>
                      <Button
                        size="xs"
                        onClick={handleSendFeedback}
                        disabled={!feedbackText.trim() || sessionLimitReached}
                      >
                        Send
                      </Button>
                    </Group>
                  </Group>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <Paper
                    className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-600/20 text-emerald-200 border border-emerald-700/30"
                        : "bg-zinc-800 text-zinc-200 border border-zinc-700/50"
                    }`}
                    radius="md"
                  >
                    <Text size="xs" className="block mb-0.5 opacity-60">
                      {msg.role === "user" ? "You" : "Oracle"}
                    </Text>
                    {msg.content}
                  </Paper>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <Paper bg="dark.8" bd="1px solid var(--mantine-color-dark-6)" radius="md" px="md" py="sm">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: "300ms" }} />
                    </span>
                  </Paper>
                </div>
              )}

              <div ref={messagesEndRef} />
            </Stack>
          </ScrollArea>

          {sessionLimitReached ? (
            <Text size="xs" c="dimmed" ta="center" py="sm" className="border-t border-zinc-800 shrink-0">
              Conversation limit reached. Refresh to start a new one.
            </Text>
          ) : (
            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-zinc-800 shrink-0">
              <Group align="flex-end" gap="sm">
                <div className="flex-1 relative">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.currentTarget.value.slice(0, MAX_INPUT_LENGTH))}
                    placeholder="Ask anything..."
                    minRows={1}
                    maxRows={4}
                    disabled={isThinking}
                    className="!pr-14"
                  />
                  <Text
                    size="xs"
                    c={input.length >= MAX_INPUT_LENGTH ? "red" : "dimmed"}
                    className="absolute right-2 bottom-2"
                  >
                    {input.length}/{MAX_INPUT_LENGTH}
                  </Text>
                </div>
                <ActionIcon
                  type="submit"
                  disabled={!input.trim() || isThinking}
                  size="lg"
                  variant="filled"
                  color="emerald"
                  aria-label="Send message"
                >
                  <IconSend size={16} />
                </ActionIcon>
              </Group>
            </form>
          )}
        </Paper>
      </Paper>
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
