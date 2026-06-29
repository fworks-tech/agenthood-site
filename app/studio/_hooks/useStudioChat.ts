"use client";

import { useState, useRef, useCallback } from "react";
import { readSSEStream } from "../_lib/stream";
import { sendChat } from "../_lib/studio-api";
import type { ChatMessage } from "../_lib/studio-api";
import type { ChatConfig } from "../_types/chat-config";

const STORAGE_KEY = "agenthood-studio-conversations";

interface Conversation {
  id: string;
  agentId: string;
  messages: ChatMessage[];
  config: Partial<ChatConfig>;
  createdAt: number;
}

interface UseStudioChatOptions {
  config: Partial<ChatConfig>;
}

interface UseStudioChatReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  abortStream: () => void;
  clearMessages: () => void;
  newConversation: (agentId: string) => void;
  switchConversation: (id: string) => void;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {}
}

function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("agenthood-studio-active-conversation");
  } catch {
    return null;
  }
}

function setActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem("agenthood-studio-active-conversation", id);
    else localStorage.removeItem("agenthood-studio-active-conversation");
  } catch {}
}

export function useStudioChat(options?: UseStudioChatOptions): UseStudioChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(getActiveId);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConv?.messages ?? [];

  const persist = useCallback((convs: Conversation[], activeId: string | null) => {
    setConversations(convs);
    saveConversations(convs);
    if (activeId !== undefined) {
      setActiveConversationId(activeId);
      setActiveId(activeId);
    }
  }, []);

  const newConversation = useCallback((agentId: string) => {
    const conv: Conversation = {
      id: generateId(),
      agentId,
      messages: [],
      config: options?.config ?? {},
      createdAt: Date.now(),
    };
    const updated = [...conversations, conv];
    persist(updated, conv.id);
  }, [conversations, persist, options?.config]);

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveId(id);
  }, []);

  const clearMessages = useCallback(() => {
    if (!activeConversationId) return;
    const updated = conversations.map((c) =>
      c.id === activeConversationId ? { ...c, messages: [] } : c,
    );
    persist(updated, activeConversationId);
  }, [conversations, activeConversationId, persist]);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConv || isStreaming || !content.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: content.trim(), id: generateId() };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", id: generateId() };

    const updatedMessages = [...activeConv.messages, userMsg, assistantMsg];
    const updated = conversations.map((c) =>
      c.id === activeConversationId ? { ...c, messages: updatedMessages } : c,
    );
    persist(updated, activeConversationId);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await sendChat(
        activeConv.agentId,
        updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        activeConv.config ?? {},
        abortController.signal,
      );

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      let streamedContent = "";

      await readSSEStream(
        res,
        {
          onToken: (token) => {
            streamedContent += token;
            const withStream = conversations.map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: streamedContent } : m,
                    ),
                  }
                : c,
            );
            setConversations(withStream);
          },
          onDone: () => {
            const final = conversations.map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: streamedContent } : m,
                    ),
                  }
                : c,
            );
            persist(final, activeConversationId);
            setIsStreaming(false);
          },
          onError: (err) => {
            const errorMsg = `Error: ${err.message}`;
            const withError = conversations.map((c) =>
              c.id === activeConversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: errorMsg } : m,
                    ),
                  }
                : c,
            );
            persist(withError, activeConversationId);
            setIsStreaming(false);
          },
        },
        abortController.signal,
      );
    } catch (err) {
      if (abortController.signal.aborted) {
        setIsStreaming(false);
        return;
      }
      const errorMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
      const withError = conversations.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: errorMsg } : m,
              ),
            }
          : c,
      );
      persist(withError, activeConversationId);
      setIsStreaming(false);
    }
  }, [activeConv, activeConversationId, conversations, isStreaming, persist]);

  const abortStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    conversations,
    activeConversationId,
    isStreaming,
    messages,
    sendMessage,
    abortStream,
    clearMessages,
    newConversation,
    switchConversation,
  };
}
