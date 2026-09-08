/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolReplay } from '../app/(main)/studio/_hooks/useToolReplay';

vi.mock('../app/(main)/studio/_lib/env', () => ({
  TURNSTILE_REQUIRED: true,
  TURNSTILE_ENABLED: true,
}));
vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
import { track } from '@vercel/analytics';

describe('useToolReplay captcha short-circuit', () => {
  const addLog = vi.fn();
  let replayToolCall: ReturnType<typeof vi.fn>;
  let captcha: any;

  beforeEach(() => {
    vi.clearAllMocks();
    replayToolCall = vi.fn().mockResolvedValue({ ok: true, outcome: {} });
    captcha = {
      tokenRef: { current: 'tok' },
      refreshAndWait: vi.fn().mockResolvedValue(true),
      onError: vi.fn(),
      verified: false,
    };
  });

  it('skips refresh and replays tokenless when already verified', async () => {
    captcha.verified = true;
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    await act(async () => {
      await result.current.handleReplay('msg-1', 'tool-1');
    });
    expect(captcha.refreshAndWait).not.toHaveBeenCalled();
    expect(replayToolCall).toHaveBeenCalledWith('msg-1', 'tool-1', undefined);
    expect(track).toHaveBeenCalledWith('tool_replayed', expect.objectContaining({ ok: true }));
  });

  it('refreshes and retries once on CAPTCHA_FAILED', async () => {
    captcha.verified = true;
    const captchaErr = Object.assign(new Error('consumed'), { code: 'CAPTCHA_FAILED' });
    replayToolCall.mockRejectedValueOnce(captchaErr).mockResolvedValueOnce({ ok: true, outcome: {} });
    captcha.tokenRef.current = 'fresh-tok';
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    await act(async () => {
      await result.current.handleReplay('msg-1', 'tool-1');
    });
    expect(captcha.refreshAndWait).toHaveBeenCalledTimes(1);
    expect(replayToolCall).toHaveBeenCalledTimes(2);
    expect(replayToolCall).toHaveBeenNthCalledWith(1, 'msg-1', 'tool-1', undefined);
    expect(replayToolCall).toHaveBeenNthCalledWith(2, 'msg-1', 'tool-1', 'fresh-tok');
    expect(addLog).toHaveBeenCalledWith('warn', expect.stringContaining('Refreshing and retrying'), expect.objectContaining({ category: 'captcha' }));
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('(retry)'));
  });

  it('surfaces a timeout when the post-failure refresh does not produce a token', async () => {
    captcha.verified = true;
    const captchaErr = Object.assign(new Error('consumed'), { code: 'CAPTCHA_FAILED' });
    replayToolCall.mockRejectedValueOnce(captchaErr);
    captcha.refreshAndWait.mockResolvedValue(false);
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    await act(async () => {
      await result.current.handleReplay('msg-1', 'tool-1');
    });
    expect(captcha.refreshAndWait).toHaveBeenCalledTimes(1);
    expect(captcha.onError).toHaveBeenCalledWith('CAPTCHA refresh timed out. Please verify manually.');
    expect(replayToolCall).toHaveBeenCalledTimes(1);
  });
});
