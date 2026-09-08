'use client';

import { useCallback, useRef } from 'react';
import { track } from '@vercel/analytics';
import { TURNSTILE_REQUIRED } from '../_lib/env';
import type { LogLevel, LogCategory } from '../_lib/log-types';
import type { useStudioChat } from './useStudioChat';
import type { useCaptcha } from './useCaptcha';

type Chat = ReturnType<typeof useStudioChat>;
type Captcha = ReturnType<typeof useCaptcha>;

interface UseToolReplayOptions {
  chat: Pick<Chat, 'replayToolCall'>;
  captcha: Pick<Captcha, 'tokenRef' | 'refreshAndWait' | 'onError' | 'verified'>;
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void;
}

function errorCode(err: unknown): string | undefined {
  return err instanceof Error ? (err as Error & { code?: string }).code : undefined;
}

export function useToolReplay(options: UseToolReplayOptions) {
  const { chat, captcha, addLog } = options;
  const replayingRef = useRef(false);

  const handleReplay = useCallback(
    async (messageId: string, toolCallId: string) => {
      if (replayingRef.current) return;
      replayingRef.current = true;
      try {
        // Short-circuit: a valid captcha_verified cookie already covers auth, so
        // skip the forced widget refresh and replay tokenless. The server skips
        // token validation when the signed cookie is present (captcha.ts:97).
        const fresh = TURNSTILE_REQUIRED && !captcha.verified ? await captcha.refreshAndWait() : false;
        const result = await chat.replayToolCall(
          messageId,
          toolCallId,
          fresh ? captcha.tokenRef.current ?? undefined : undefined,
        );
        if (result.ok) {
          addLog('info', '↻ Tool re-executed successfully');
        } else {
          addLog('error', `↻ Tool re-execution failed: ${result.outcome.error ?? 'unknown error'}`);
        }
        track('tool_replayed', { ok: result.ok, toolCallId });
      } catch (err) {
        if (errorCode(err) === 'CAPTCHA_FAILED') {
          // Stale latch (>24h idle): the cookie no longer validates. Refresh and
          // retry once with the fresh token, mirroring useSendMessage.
          addLog('warn', 'CAPTCHA token expired during replay. Refreshing and retrying...', { category: 'captcha' });
          const ready = await captcha.refreshAndWait();
          if (!ready) {
            captcha.onError('CAPTCHA refresh timed out. Please verify manually.');
            addLog('error', `↻ Tool re-execution error: ${err instanceof Error ? err.message : String(err)}`);
            return;
          }
          try {
            const retryResult = await chat.replayToolCall(messageId, toolCallId, captcha.tokenRef.current ?? undefined);
            if (retryResult.ok) {
              addLog('info', '↻ Tool re-executed successfully (retry)');
            } else {
              addLog('error', `↻ Tool re-execution failed: ${retryResult.outcome.error ?? 'unknown error'}`);
            }
            track('tool_replayed', { ok: retryResult.ok, toolCallId });
          } catch (retryErr) {
            addLog('error', `↻ Tool re-execution error: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
          }
          return;
        }
        addLog('error', `↻ Tool re-execution error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        replayingRef.current = false;
      }
    },
    [chat, captcha, addLog],
  );

  return { handleReplay };
}
