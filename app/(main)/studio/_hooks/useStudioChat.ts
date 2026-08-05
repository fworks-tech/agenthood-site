"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { readSSEStream } from "../_lib/stream";
import { sendChat } from "../_lib/studio-api";
import type { ChatMessage, ToolCallInfo } from "../_lib/studio-api";
import type { ChatConfig } from "../_types/studio";
import { STORAGE_KEYS } from "../_lib/constants";
const MAX_CONVERSATIONS = 50;
const MAX_CONVERSATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  config: Partial<ChatConfig>;
  createdAt: number;
  tokenCount: number;
}

interface UseStudioChatOptions {
  config: Partial<ChatConfig>;
  turnstileToken?: string;
}

interface UseStudioChatReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  messages: ChatMessage[];
  totalTokens: number;
  hydrated: boolean;
  sendMessage: (content: string) => Promise<"completed" | "aborted">;
  abortStream: () => void;
  clearMessages: () => void;
  newConversation: (agentId: string, config?: Partial<ChatConfig>) => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function migrateConversation(c: Record<string, unknown>): Conversation {
  return {
    id: c.id as string,
    agentId: c.agentId as string,
    title: (c.title as string) ?? "New conversation",
    messages: (c.messages as Conversation["messages"]) ?? [],
    config: (c.config as Conversation["config"]) ?? {},
    createdAt: (c.createdAt as number) ?? Date.now(),
    tokenCount: (c.tokenCount as number) ?? 0,
  };
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    const rawConvs = JSON.parse(raw);
    if (!Array.isArray(rawConvs)) return [];
    return rawConvs
      .map(migrateConversation)
      .filter((c) => Date.now() - c.createdAt < MAX_CONVERSATION_AGE_MS);
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)));
  } catch {
    /* localStorage full or unavailable */
  }
}

function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
  } catch {
    return null;
  }
}

function setActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONVERSATION);
  } catch {}
}

function updateMessage(convs: Conversation[], convId: string, msgId: string, content: string): Conversation[] {
  return convs.map((c) =>
    c.id === convId
      ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, content } : m)) }
      : c,
  );
}

export function useStudioChat(options?: UseStudioChatOptions): UseStudioChatReturn {
  const [hydrated, setHydrated] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const configRef = useRef<Partial<ChatConfig>>(options?.config);
  const turnstileRef = useRef<string | undefined>(options?.turnstileToken);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadConversations();
    const activeId = getActiveId();
    setConversations(saved);
    conversationsRef.current = saved;
    setActiveConversationId(activeId);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    configRef.current = options?.config;
  }, [options?.config]);

  useEffect(() => {
    turnstileRef.current = options?.turnstileToken;
  }, [options?.turnstileToken]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConv?.messages ?? [];

  const persist = useCallback((convs: Conversation[], activeId: string | null) => {
    setConversations(convs);
    conversationsRef.current = convs;
    saveConversations(convs);
    if (activeId !== undefined) {
      setActiveConversationId(activeId);
      setActiveId(activeId);
    }
  }, []);

  const generateTitle = useCallback((messages: ChatMessage[]): string => {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      const text = firstUser.content.replace(/\n/g, " ").trim();
      return text.length > 60 ? text.slice(0, 60) + "…" : text;
    }
    return "New conversation";
  }, []);

  const newConversation = useCallback((agentId: string, config?: Partial<ChatConfig>) => {
    const conv: Conversation = {
      id: generateId(),
      agentId,
      title: "New conversation",
      messages: [],
      config: config ?? configRef.current ?? {},
      createdAt: Date.now(),
      tokenCount: 0,
    };
    const updated = [...conversationsRef.current, conv];
    persist(updated, conv.id);
    setTotalTokens(0);
  }, [persist]);

  const deleteConversation = useCallback((id: string) => {
    const updated = conversationsRef.current.filter((c) => c.id !== id);
    const nextId = id === activeConversationId
      ? (updated[updated.length - 1]?.id ?? null)
      : activeConversationId;
    persist(updated, nextId);
    if (nextId === null) setTotalTokens(0);
  }, [activeConversationId, persist]);

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveId(id);
    const conv = conversationsRef.current.find((c) => c.id === id);
    setTotalTokens(conv?.tokenCount ?? 0);
  }, []);

  const clearMessages = useCallback(() => {
    const cid = activeConversationId;
    if (!cid) return;
    const updated = conversationsRef.current.map((c) =>
      c.id === cid ? { ...c, messages: [], tokenCount: 0 } : c,
    );
    persist(updated, cid);
    setTotalTokens(0);
  }, [activeConversationId, persist]);

  const sendMessage = useCallback(async (content: string): Promise<"completed" | "aborted"> => {
    const conv = conversationsRef.current.find((c) => c.id === activeConversationId);
    if (!conv || isStreaming || !content.trim()) return "aborted";

    const userMsg: ChatMessage = { role: "user", content: content.trim(), id: generateId() };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", id: generateId(), toolCalls: [] };

    const updatedMessages = [...conv.messages, userMsg, assistantMsg];
    const autoTitle = conv.title === "New conversation"
      ? generateTitle(updatedMessages)
      : conv.title;
    const withMessages = conversationsRef.current.map((c) =>
      c.id === activeConversationId ? { ...c, messages: updatedMessages, title: autoTitle } : c,
    );
    persist(withMessages, activeConversationId);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    const baseTokens = conv.tokenCount ?? 0;
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    let streamedContent = "";
    let streamError: Error | null = null;
    const persistTokens = (convs: Conversation[]): Conversation[] => {
      const finalTokens = baseTokens + estimateTokens(streamedContent);
      const withTokens = convs.map((c) =>
        c.id === activeConversationId ? { ...c, tokenCount: finalTokens } : c,
      );
      saveConversations(withTokens);
      return withTokens;
    };

    let flushScheduled = false;
    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      requestAnimationFrame(() => {
        flushScheduled = false;
        setTotalTokens(baseTokens + estimateTokens(streamedContent));
        setConversations((prev) => updateMessage(prev, activeConversationId!, assistantMsg.id, streamedContent));
      });
    };

    try {
      const res = await sendChat(
        conv.agentId,
        updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        configRef.current ?? {},
        turnstileRef.current,
        abortController.signal,
      );

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const pendingToolCalls: ToolCallInfo[] = [];

      await readSSEStream(
        res,
        {
          onToken: (token) => {
            streamedContent += token;
            scheduleFlush();
          },
          onToolCall: (tc) => {
            pendingToolCalls.push({ id: tc.id, name: tc.name, args: tc.args, status: "pending" });
            setConversations((prev) => {
              const conv = prev.find((c) => c.id === activeConversationId);
              if (!conv) return prev;
              const msg = conv.messages.find((m) => m.id === assistantMsg.id);
              if (!msg) return prev;
              return updateMessage(prev, activeConversationId!, assistantMsg.id, streamedContent);
            });
          },
          onToolResult: (tr) => {
            const existing = pendingToolCalls.find((t) => t.id === tr.id);
            if (existing) {
              existing.status = tr.error ? "error" : "complete";
              existing.result = tr.result;
              existing.error = tr.error;
            }
            setConversations((prev) => {
              const conv = prev.find((c) => c.id === activeConversationId);
              if (!conv) return prev;
              const msg = conv.messages.find((m) => m.id === assistantMsg.id);
              if (!msg) return prev;
              return prev.map((c) =>
                c.id === activeConversationId
                  ? { ...c, messages: c.messages.map((m) => m.id === assistantMsg.id ? { ...m, toolCalls: [...pendingToolCalls] } : m) }
                  : c,
              );
            });
          },
          onDone: () => {
            setConversations((prev) => {
              const final = persistTokens(updateMessage(prev, activeConversationId!, assistantMsg.id, streamedContent));
              return final;
            });
            setTotalTokens(baseTokens + estimateTokens(streamedContent));
            setIsStreaming(false);
          },
          onError: (err) => {
            streamError = err;
            const errorMsg = `Error: ${err.message}`;
            setConversations((prev) => {
              const withError = persistTokens(updateMessage(prev, activeConversationId!, assistantMsg.id, errorMsg));
              return withError;
            });
            setIsStreaming(false);
          },
        },
        abortController.signal,
      );

      if (abortController.signal.aborted) return "aborted";
      if (streamError) throw streamError;
      return "completed";
    } catch (err) {
      if (abortController.signal.aborted) {
        setIsStreaming(false);
        return "aborted";
      }
      if (!streamError) {
        const errorMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        setConversations((prev) => {
          const withError = persistTokens(updateMessage(prev, activeConversationId!, assistantMsg.id, errorMsg));
          return withError;
        });
      }
      setIsStreaming(false);
      throw err;
    }
  }, [activeConversationId, isStreaming, persist, generateTitle]);

  const abortStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    conversations,
    activeConversationId,
    isStreaming,
    messages,
    totalTokens,
    hydrated,
    sendMessage,
    abortStream,
    clearMessages,
    newConversation,
    switchConversation,
    deleteConversation,
  };
}
