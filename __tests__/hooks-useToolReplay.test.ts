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

describe('useToolReplay', () => {
  const addLog = vi.fn();
  let replayToolCall: ReturnType<typeof vi.fn>;
  let captcha: any;

  beforeEach(() => {
    vi.clearAllMocks();
    replayToolCall = vi.fn().mockResolvedValue({ ok: true, outcome: {} });
    captcha = {
      tokenRef: { current: 'tok' },
      refreshAndWait: vi.fn().mockResolvedValue(true),
    };
  });

  it('calls replayToolCall with fresh token when TURNSTILE_REQUIRED', async () => {
    // mock env to require captcha by making refreshAndWait return true
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    await act(async () => {
      await result.current.handleReplay('msg-1', 'tool-1');
    });
    expect(captcha.refreshAndWait).toHaveBeenCalled();
    expect(replayToolCall).toHaveBeenCalledWith('msg-1', 'tool-1', 'tok');
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('successfully'));
    expect(track).toHaveBeenCalledWith('tool_replayed', expect.objectContaining({ ok: true }));
  });

  it('logs failure when outcome has error', async () => {
    replayToolCall.mockResolvedValue({ ok: false, outcome: { error: 'boom' } });
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    await act(async () => {
      await result.current.handleReplay('m', 't');
    });
    expect(addLog).toHaveBeenCalledWith('error', expect.stringContaining('boom'));
  });

  it('logs exception when replay throws', async () => {
    replayToolCall.mockRejectedValue(new Error('network down'));
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    await act(async () => {
      await result.current.handleReplay('m', 't');
    });
    expect(addLog).toHaveBeenCalledWith('error', expect.stringContaining('network down'));
  });

  it('prevents concurrent replays', async () => {
    let resolve: any;
    replayToolCall.mockImplementation(() => new Promise((r) => (resolve = r)));
    const chat: any = { replayToolCall };
    const { result } = renderHook(() => useToolReplay({ chat, captcha, addLog }));
    const p1 = result.current.handleReplay('m', 't');
    const p2 = result.current.handleReplay('m', 't'); // should be ignored due to ref
    await act(async () => {
      await Promise.resolve();
    });
    expect(replayToolCall).toHaveBeenCalledTimes(1);
    resolve({ ok: true, outcome: {} });
    await act(async () => {
      await p1;
      await p2;
    });
  });
});
