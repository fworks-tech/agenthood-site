/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCaptcha } from '../app/(main)/studio/_hooks/useCaptcha';

describe('useCaptcha', () => {
  const addLog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with null token and not verified', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    expect(result.current.token).toBeNull();
    expect(result.current.verified).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isRequired).toEqual(expect.any(Boolean));
  });

  it('onStatus logs and keeps verified latched on token-expired', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    act(() => result.current.setToken('tok-1'));
    expect(result.current.token).toBe('tok-1');
    // token effect auto-verifies
    expect(result.current.verified).toBe(true);
    act(() => result.current.onStatus('token-expired'));
    // expired token keeps the last value and the verified latch stays true so the
    // interactive widget does not pop back unchecked on every token cycle
    expect(result.current.verified).toBe(true);
    expect(result.current.token).toBe('tok-1');
    expect(addLog).toHaveBeenCalledWith('warn', expect.stringContaining('expired'), expect.any(Object));
  });

  it('retry clears token and bumps refreshKey but keeps verified latch', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    act(() => result.current.setToken('tok'));
    expect(result.current.verified).toBe(true);
    const k0 = result.current.refreshKey;
    act(() => result.current.retry());
    expect(result.current.token).toBeNull();
    expect(result.current.refreshKey).toBe(k0 + 1);
    expect(result.current.verified).toBe(true);
  });

  it('onError sets error and logs', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    act(() => result.current.onError('captcha failed'));
    expect(result.current.error).toBe('captcha failed');
    expect(addLog).toHaveBeenCalledWith('error', 'captcha failed', expect.any(Object));
  });

  it('refreshAndWait resolves false when no token arrives in time', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCaptcha({ addLog }));
      expect(typeof result.current.refreshAndWait).toBe('function');
      let p: Promise<boolean>;
      act(() => {
        p = result.current.refreshAndWait();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000 + 200);
      });
      await expect(p!).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshAndWait resolves true once a token is set', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useCaptcha({ addLog }));
      let p: Promise<boolean>;
      act(() => {
        p = result.current.refreshAndWait();
      });
      act(() => result.current.setToken('fresh'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      await expect(p!).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('onStatus handles all branches without throwing', () => {
    const localLog = vi.fn();
    const { result } = renderHook(() => useCaptcha({ addLog: localLog }));
    expect(result.current).toBeDefined();
    expect(result.current.onStatus).toBeDefined();
    // call each status inside act to ensure state updates are wrapped
    for (const s of ['script-loading', 'script-loaded', 'widget-rendered', 'retrying', 'token-received'] as const) {
      act(() => {
        result.current.onStatus(s);
      });
    }
    expect(localLog).toHaveBeenCalled();
  });
});
