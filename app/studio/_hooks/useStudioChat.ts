"use client";

import { useState, useRef, useCallback } from "react";
import { readSSEStream } from "../_lib/stream";
import { sendChat } from "../_lib/studio-api";
import type { ChatMessage } from "../_lib/studio-api";
import type { ChatConfig } from "../_types/studio";

const STORAGE_KEY = "agenthood-studio-conversations";
const MAX_CONVERSATIONS = 50;
const MAX_CONVERSATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
    if (!raw) return [];
    const convs: Conversation[] = JSON.parse(raw);
    return convs.filter((c) => Date.now() - c.createdAt < MAX_CONVERSATION_AGE_MS);
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)));
  } catch {
    /* localStorage full or unavailable */
  }
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

function updateMessage(convs: Conversation[], convId: string, msgId: string, content: string): Conversation[] {
  return convs.map((c) =>
    c.id === convId
      ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, content } : m)) }
      : c,
  );
}

export function useStudioChat(options?: UseStudioChatOptions): UseStudioChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(getActiveId);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

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

  const newConversation = useCallback((agentId: string) => {
    const conv: Conversation = {
      id: generateId(),
      agentId,
      messages: [],
      config: options?.config ?? {},
      createdAt: Date.now(),
    };
    const updated = [...conversationsRef.current, conv];
    persist(updated, conv.id);
  }, [persist, options?.config]);

  const switchConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveId(id);
  }, []);

  const clearMessages = useCallback(() => {
    const cid = activeConversationId;
    if (!cid) return;
    const updated = conversationsRef.current.map((c) =>
      c.id === cid ? { ...c, messages: [] } : c,
    );
    persist(updated, cid);
  }, [activeConversationId, persist]);

  const sendMessage = useCallback(async (content: string) => {
    const conv = conversationsRef.current.find((c) => c.id === activeConversationId);
    if (!conv || isStreaming || !content.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: content.trim(), id: generateId() };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", id: generateId() };

    const updatedMessages = [...conv.messages, userMsg, assistantMsg];
    const withMessages = conversationsRef.current.map((c) =>
      c.id === activeConversationId ? { ...c, messages: updatedMessages } : c,
    );
    persist(withMessages, activeConversationId);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await sendChat(
        conv.agentId,
        updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        conv.config ?? {},
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
            setConversations((prev) => updateMessage(prev, activeConversationId!, assistantMsg.id, streamedContent));
          },
          onDone: () => {
            setConversations((prev) => {
              const final = updateMessage(prev, activeConversationId!, assistantMsg.id, streamedContent);
              saveConversations(final);
              return final;
            });
            setIsStreaming(false);
          },
          onError: (err) => {
            const errorMsg = `Error: ${err.message}`;
            setConversations((prev) => {
              const withError = updateMessage(prev, activeConversationId!, assistantMsg.id, errorMsg);
              saveConversations(withError);
              return withError;
            });
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
      setConversations((prev) => {
        const withError = updateMessage(prev, activeConversationId!, assistantMsg.id, errorMsg);
        saveConversations(withError);
        return withError;
      });
      setIsStreaming(false);
    }
  }, [activeConversationId, isStreaming, persist]);

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
