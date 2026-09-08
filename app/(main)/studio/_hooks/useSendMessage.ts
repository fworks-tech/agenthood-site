'use client';

import { useCallback } from 'react';
import { track } from '@vercel/analytics';
import type { AgentEntry } from '../_data/agents';
import type { ChatConfig } from '../_types/studio';
import type { LogLevel, LogCategory } from '../_lib/log-types';
import type { useCaptcha } from './useCaptcha';
import type { useStudioChat } from './useStudioChat';

type Chat = ReturnType<typeof useStudioChat>;
type Captcha = ReturnType<typeof useCaptcha>;

interface UseSendMessageOptions {
  chat: Pick<Chat, 'sendMessage' | 'retrySendMessage' | 'totalTokens'>;
  selectedAgent: AgentEntry | null;
  config: Pick<ChatConfig, 'provider' | 'model'>;
  activeConversationId: string | null;
  captcha: Pick<Captcha, 'isRequired' | 'tokenRef' | 'refreshAndWait' | 'onError'>;
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void;
}

function errorCode(err: unknown): string | undefined {
  return err instanceof Error ? (err as Error & { code?: string }).code : undefined;
}

export function useSendMessage(options: UseSendMessageOptions) {
  const { chat, selectedAgent, config, activeConversationId, captcha, addLog } = options;

  const handleChatSuccess = useCallback(
    (elapsed: string, durationMs: number, retried: boolean) => {
      if (!selectedAgent) return;
      addLog('info', `✓ ${selectedAgent.icon ?? ''} ${selectedAgent.name} completed in ${elapsed}s${retried ? ' (retry)' : ''}`);
      track('message_completed', {
        agentId: selectedAgent.id,
        provider: config.provider,
        model: config.model,
        durationMs,
        tokenCount: chat.totalTokens,
      });
    },
    [chat.totalTokens, selectedAgent, config.provider, config.model, addLog],
  );

  const handleChatError = useCallback(
    (err: unknown, ts: number) => {
      if (!selectedAgent) return;
      const elapsed = ((Date.now() - ts) / 1000).toFixed(1);
      addLog(
        'error',
        `✗ ${selectedAgent.icon ?? ''} ${selectedAgent.name} failed after ${elapsed}s: ${err instanceof Error ? err.message : String(err)}`,
      );
      track('message_error', {
        agentId: selectedAgent.id,
        provider: config.provider,
        model: config.model,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    [selectedAgent, config.provider, config.model, addLog],
  );

  const handleCaptchaRetry = useCallback(
    async (content: string, ts: number, err: unknown) => {
      addLog('warn', 'CAPTCHA token expired. Refreshing and retrying...', { category: 'captcha' });
      const ready = await captcha.refreshAndWait();
      if (!ready) {
        captcha.onError('CAPTCHA refresh timed out. Please verify manually.');
        handleChatError(err, ts);
        return;
      }
      try {
        await chat.retrySendMessage(content, captcha.tokenRef.current ?? undefined);
        handleChatSuccess(((Date.now() - ts) / 1000).toFixed(1), Date.now() - ts, true);
      } catch (retryErr) {
        handleChatError(retryErr, ts);
      }
    },
    [chat, captcha, addLog, handleChatSuccess, handleChatError],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedAgent) return;
      // Require a token for the send; the widget stays hidden after the first
      // verification but the fresh token is still sent so the first request
      // can establish the signed cookie (the cookie then covers all later
      // messages and prevents the consumed-token 400).
      if (captcha.isRequired && !captcha.tokenRef.current) {
        addLog('warn', 'CAPTCHA token not ready yet. Please wait a moment.', { category: 'captcha' });
        return;
      }
      const ts = Date.now();
      addLog('info', `→ ${selectedAgent.icon ?? ''} ${selectedAgent.name} · ${config.provider} · ${config.model}`);
      track('message_sent', {
        agentId: selectedAgent.id,
        provider: config.provider,
        model: config.model,
        conversationId: activeConversationId ?? undefined,
      });
      const captchaToken = captcha.tokenRef.current ?? undefined;
      try {
        await chat.sendMessage(content, captchaToken);
        handleChatSuccess(((Date.now() - ts) / 1000).toFixed(1), Date.now() - ts, false);
      } catch (err) {
        if (errorCode(err) === 'CAPTCHA_FAILED') {
          await handleCaptchaRetry(content, ts, err);
          return;
        }
        handleChatError(err, ts);
      }
    },
    [chat, selectedAgent, config.provider, config.model, activeConversationId, addLog, captcha, handleChatSuccess, handleChatError, handleCaptchaRetry],
  );

  return { handleSendMessage };
}
