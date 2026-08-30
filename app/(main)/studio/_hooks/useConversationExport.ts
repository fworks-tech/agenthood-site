'use client';

import { useCallback } from 'react';
import { track } from '@vercel/analytics';
import type { Conversation } from './useStudioChat';
import {
  conversationFilename,
  downloadBlob,
  serializeConversationJson,
  serializeConversationMarkdown,
} from '../_lib/export-conversation';
import type { LogLevel, LogCategory } from '../_lib/log-types';

interface UseConversationExportOptions {
  conversations: Conversation[];
  activeConversationId: string | null;
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void;
}

export function useConversationExport(options: UseConversationExportOptions) {
  const { conversations, activeConversationId, addLog } = options;

  const handleExport = useCallback(
    (format: 'json' | 'md') => {
      const active = conversations.find((c) => c.id === activeConversationId);
      if (!active) return;
      const filename = conversationFilename(active, format);
      const mime = format === 'json' ? 'application/json' : 'text/markdown';
      const content =
        format === 'json' ? serializeConversationJson(active) : serializeConversationMarkdown(active);
      downloadBlob(filename, mime, content);
      addLog('info', `Exported conversation as ${format.toUpperCase()}`);
      track('conversation_exported', { format, conversationId: active.id });
    },
    [conversations, activeConversationId, addLog],
  );

  return { handleExport };
}
