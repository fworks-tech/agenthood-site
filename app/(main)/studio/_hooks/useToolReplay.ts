'use client';

import { useCallback, useRef } from 'react';
import { track } from '@vercel/analytics';
import { TURNSTILE_REQUIRED } from '../_lib/env';
import type { LogLevel, LogCategory } from '../_lib/log-types';
import type { useStudioChat } from './useStudioChat';

type Chat = ReturnType<typeof useStudioChat>;

interface UseToolReplayOptions {
  chat: Pick<Chat, 'replayToolCall'>;
  captcha: { tokenRef: React.RefObject<string | null>; refreshAndWait: () => Promise<boolean> };
  addLog: (level: LogLevel, message: string, opts?: { category?: LogCategory; detail?: string }) => void;
}

export function useToolReplay(options: UseToolReplayOptions) {
  const { chat, captcha, addLog } = options;
  const replayingRef = useRef(false);

  const handleReplay = useCallback(
    async (messageId: string, toolCallId: string) => {
      if (replayingRef.current) return;
      replayingRef.current = true;
      try {
        // One-shot: if already verified, cookie covers tool replay; otherwise refresh
        const needsCaptcha = TURNSTILE_REQUIRED && !(captcha as { verified?: boolean }).verified;
        const fresh = needsCaptcha ? await captcha.refreshAndWait() : false;
        const token = (captcha as { verified?: boolean }).verified
          ? undefined
          : fresh
            ? captcha.tokenRef.current ?? undefined
            : undefined;
        const result = await chat.replayToolCall(messageId, toolCallId, token);
        if (result.ok) {
          addLog('info', '↻ Tool re-executed successfully');
        } else {
          addLog('error', `↻ Tool re-execution failed: ${result.outcome.error ?? 'unknown error'}`);
        }
        track('tool_replayed', { ok: result.ok, toolCallId });
      } catch (err) {
        addLog('error', `↻ Tool re-execution error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        replayingRef.current = false;
      }
    },
    [chat, captcha, addLog],
  );

  return { handleReplay };
}
