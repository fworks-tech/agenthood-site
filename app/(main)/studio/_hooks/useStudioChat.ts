"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { readSSEStream, type StreamLogEvent } from "../_lib/stream";
import { sendChat, replayToolExecution } from "../_lib/studio-api";
import type { ChatMessage, ToolCallInfo } from "../_lib/studio-api";
import { applyToolReplayOutcome } from "../_lib/tool-outcome";
import type { ChatConfig } from "../_types/studio";
import { STORAGE_KEYS } from "../_lib/constants";

const MAX_CONVERSATIONS = 50;
const MAX_CONVERSATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SEND_HISTORY = 20;
const MAX_SEND_MESSAGE_LENGTH = 3500;
const TRUNCATED_SUMMARY_LENGTH = 500;

function truncateMessages(
  messages: { role: string; content: string }[],
): { role: string; content: string }[] {
  if (messages.length <= MAX_SEND_HISTORY) {
    return messages.map((m) => ({
      ...m,
      content:
        m.content.length > MAX_SEND_MESSAGE_LENGTH
          ? m.content.slice(0, MAX_SEND_MESSAGE_LENGTH) + "\n\n[truncated]"
          : m.content,
    }));
  }
  const cutoff = messages.length - MAX_SEND_HISTORY;
  return messages.map((m, i) => ({
    ...m,
    content:
      i < cutoff
        ? m.content.length > TRUNCATED_SUMMARY_LENGTH
          ? m.content.slice(0, TRUNCATED_SUMMARY_LENGTH) + "\n\n[truncated]"
          : m.content
        : m.content,
  }));
}

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
  onLog?: (log: StreamLogEvent) => void;
}

interface UseStudioChatReturn {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  messages: ChatMessage[];
  totalTokens: number;
  hydrated: boolean;
  sendMessage: (content: string, turnstileToken?: string) => Promise<void>;
  retrySendMessage: (content: string, turnstileToken?: string) => Promise<void>;
  replayToolCall: (
    messageId: string,
    toolCallId: string,
    turnstileToken?: string,
  ) => Promise<{ ok: boolean; outcome: { error?: string } }>;
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

const useHydrateOnClient = typeof window === "undefined" ? useEffect : useLayoutEffect;

function updateMessage(convs: Conversation[], convId: string, msgId: string, content: string): Conversation[] {
  return convs.map((c) =>
    c.id === convId
      ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, content } : m)) }
      : c,
  );
}

function withToolResults(
  convs: Conversation[],
  convId: string,
  msgId: string,
  toolCalls: ToolCallInfo[],
): Conversation[] {
  return convs.map((c) =>
    c.id === convId
      ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, toolCalls: [...toolCalls] } : m)) }
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
  const onLogRef = useRef<UseStudioChatOptions["onLog"]>(options?.onLog);

  useHydrateOnClient(() => {
    const saved = loadConversations();
    const activeId = getActiveId();
    setConversations(saved);
    conversationsRef.current = saved;
    setActiveConversationId(activeId);
    setHydrated(true);
  }, []);

  useEffect(() => {
    configRef.current = options?.config;
  }, [options?.config]);

  useEffect(() => {
    onLogRef.current = options?.onLog;
  }, [options?.onLog]);

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

  const generateTitle = useCallback((msgs: ChatMessage[]): string => {
    const firstUser = msgs.find((m) => m.role === "user");
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
      c.id === cid ? { ...c, messages: [] } : c,
    );
    persist(updated, cid);
    setTotalTokens(0);
  }, [activeConversationId, persist]);

  const runStreamingFlow = useCallback(async (
    agentId: string,
    messagesToSend: { role: string; content: string }[],
    assistantMsgId: string,
    convId: string,
    baseTokens: number,
    turnstileToken: string | undefined,
    handleCaptchaFailed: () => void,
    handleGenericError: (errorMsg: string) => void,
  ) => {
    const abortController = new AbortController();
    abortRef.current = abortController;
    let estimatedTokens = 0;
    const estimate = (text: string) => Math.ceil(text.length / 4);

    const withTokenCount = (convs: Conversation[]): Conversation[] =>
      convs.map((c) => (c.id === convId ? { ...c, tokenCount: baseTokens + estimatedTokens } : c));

    try {
      const res = await sendChat(
        agentId,
        truncateMessages(messagesToSend),
        configRef.current ?? {},
        turnstileToken,
        generateId(),
        abortController.signal,
      );

      onLogRef.current?.({
        level: res.ok ? "info" : "error",
        event: "chat.response",
        status: res.status,
        requestId: res.headers.get("x-request-id") ?? undefined,
        correlationId: res.headers.get("x-correlation-id") ?? undefined,
      });

      if (!res.ok) {
        let errorBody: { error?: string; code?: string } | null = null;
        try {
          errorBody = await res.json();
        } catch {
          /* non-JSON error body */
        }
        const msg = errorBody?.error ?? `Server error: ${res.status}`;
        const err = new Error(msg);
        (err as Error & { code?: string }).code = errorBody?.code;
        throw err;
      }

      let streamedContent = "";
      let streamError: Error | null = null;
      const pendingToolCalls: ToolCallInfo[] = [];

      await readSSEStream(
        res,
        {
          onToken: (token) => {
            streamedContent += token;
            estimatedTokens = estimate(streamedContent);
            setTotalTokens(baseTokens + estimatedTokens);
            setConversations((prev) => updateMessage(prev, convId, assistantMsgId, streamedContent));
          },
          onToolCall: (tc) => {
            pendingToolCalls.push({ id: tc.id, name: tc.name, args: tc.args, status: "pending", startedAt: Date.now() });
            setConversations((prev) => {
              const conv = prev.find((c) => c.id === convId);
              if (!conv) return prev;
              const msg = conv.messages.find((m) => m.id === assistantMsgId);
              if (!msg) return prev;
              return updateMessage(prev, convId, assistantMsgId, streamedContent);
            });
          },
          onToolResult: (tr) => {
            const existing = pendingToolCalls.find((t) => t.id === tr.id);
            if (existing) {
              existing.status = tr.error ? "error" : "complete";
              existing.result = tr.result;
              existing.error = tr.error;
              existing.completedAt = Date.now();
              existing.durationMs = existing.startedAt ? Date.now() - existing.startedAt : undefined;
            }
            setConversations((prev) => {
              const next = withToolResults(prev, convId, assistantMsgId, pendingToolCalls);
              saveConversations(next);
              return next;
            });
          },
          onDone: () => {
            setConversations((prev) => {
              const updated = updateMessage(prev, convId, assistantMsgId, streamedContent);
              const final = withTokenCount(updated);
              saveConversations(final);
              return final;
            });
            setIsStreaming(false);
          },
          onLog: (log) => onLogRef.current?.(log),
          onError: (err) => {
            streamError = err;
            const errorMsg = `Error: ${err.message}`;
            setConversations((prev) => {
              const updated = updateMessage(prev, convId, assistantMsgId, errorMsg);
              const withError = withTokenCount(updated);
              saveConversations(withError);
              return withError;
            });
            setIsStreaming(false);
          },
        },
        abortController.signal,
      );

      if (streamError) throw streamError;
    } catch (err) {
      if (abortController.signal.aborted) {
        setIsStreaming(false);
        return;
      }
      const isCaptchaFailed =
        err instanceof Error && (err as Error & { code?: string }).code === "CAPTCHA_FAILED";
      if (isCaptchaFailed) {
        handleCaptchaFailed();
      } else {
        const errorMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
        handleGenericError(errorMsg);
      }
      setIsStreaming(false);
      throw err;
    }
  }, []);

  const sendMessage = useCallback(async (content: string, turnstileToken?: string) => {
    const conv = conversationsRef.current.find((c) => c.id === activeConversationId);
    if (!conv || isStreaming || !content.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: content.trim(), id: generateId() };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", id: generateId(), toolCalls: [] };
    const updatedMessages = [...conv.messages, userMsg, assistantMsg];
    const autoTitle = conv.title === "New conversation" ? generateTitle(updatedMessages) : conv.title;
    const withMessages = conversationsRef.current.map((c) =>
      c.id === activeConversationId ? { ...c, messages: updatedMessages, title: autoTitle } : c,
    );
    persist(withMessages, activeConversationId);
    setIsStreaming(true);

    const baseTokens = conv.tokenCount ?? 0;
    const messagesToSend = updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    await runStreamingFlow(
      conv.agentId,
      messagesToSend,
      assistantMsg.id,
      activeConversationId!,
      baseTokens,
      turnstileToken,
      () => {
        const cleaned = conversationsRef.current.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages: c.messages.filter((m) => m.id !== assistantMsg.id) }
            : c,
        );
        saveConversations(cleaned);
        setConversations(cleaned);
        conversationsRef.current = cleaned;
      },
      (errorMsg) => {
        setConversations((prev) => {
          const updated = updateMessage(prev, activeConversationId!, assistantMsg.id, errorMsg);
          saveConversations(updated);
          return updated;
        });
      },
    );
  }, [activeConversationId, isStreaming, persist, generateTitle, runStreamingFlow]);

  const retrySendMessage = useCallback(async (content: string, turnstileToken?: string) => {
    const conv = conversationsRef.current.find((c) => c.id === activeConversationId);
    if (!conv || isStreaming || !content.trim()) return;
    const lastUserMsg = conv.messages.filter((m) => m.role === "user").pop();
    if (!lastUserMsg || lastUserMsg.content !== content.trim()) return;

    const assistantMsg: ChatMessage = { role: "assistant", content: "", id: generateId(), toolCalls: [] };
    const updatedMessages = [...conv.messages, assistantMsg];
    const withMessages = conversationsRef.current.map((c) =>
      c.id === activeConversationId ? { ...c, messages: updatedMessages } : c,
    );
    persist(withMessages, activeConversationId);
    setIsStreaming(true);

    const baseTokens = conv.tokenCount ?? 0;
    const messagesToSend = updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    await runStreamingFlow(
      conv.agentId,
      messagesToSend,
      assistantMsg.id,
      activeConversationId!,
      baseTokens,
      turnstileToken,
      () => {
        const cleaned = conversationsRef.current.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages: c.messages.filter((m) => m.id !== assistantMsg.id) }
            : c,
        );
        saveConversations(cleaned);
        setConversations(cleaned);
        conversationsRef.current = cleaned;
      },
      (errorMsg) => {
        setConversations((prev) => {
          const updated = updateMessage(prev, activeConversationId!, assistantMsg.id, errorMsg);
          saveConversations(updated);
          return updated;
        });
      },
    );
  }, [activeConversationId, isStreaming, persist, runStreamingFlow]);

  const abortStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const replayToolCall = useCallback(
    async (
      messageId: string,
      toolCallId: string,
      turnstileToken?: string,
    ): Promise<{ ok: boolean; outcome: { error?: string } }> => {
      const conv = conversationsRef.current.find((c) => c.id === activeConversationId);
      if (!conv) return { ok: false, outcome: {} };
      const message = conv.messages.find((m) => m.id === messageId);
      const toolCall = message?.toolCalls?.find((t) => t.id === toolCallId);
      if (!message || !toolCall) return { ok: false, outcome: {} };
      const startedAt = Date.now();
      const outcome = await replayToolExecution(toolCall.name, toolCall.args, turnstileToken);
      const next = applyToolReplayOutcome(conv, messageId, toolCallId, outcome, Date.now(), startedAt);
      const updated = conversationsRef.current.map((c) => (c.id === conv.id ? next : c));
      conversationsRef.current = updated;
      setConversations(updated);
      saveConversations(updated);
      return { ok: !outcome.error, outcome };
    },
    [activeConversationId],
  );

  return {
    conversations,
    activeConversationId,
    isStreaming,
    messages,
    totalTokens,
    hydrated,
    sendMessage,
    retrySendMessage,
    replayToolCall,
    abortStream,
    clearMessages,
    newConversation,
    switchConversation,
    deleteConversation,
  };
}
