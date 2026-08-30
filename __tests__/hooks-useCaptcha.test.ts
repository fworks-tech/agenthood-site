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

  it('onStatus logs and handles token-expired', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    act(() => result.current.setToken('tok-1'));
    expect(result.current.token).toBe('tok-1');
    // token effect auto-verifies
    expect(result.current.verified).toBe(true);
    act(() => result.current.onStatus('token-expired'));
    expect(result.current.verified).toBe(false);
    expect(result.current.token).toBeNull();
    expect(addLog).toHaveBeenCalledWith('warn', expect.stringContaining('expired'), expect.any(Object));
  });

  it('retry clears state and bumps refreshKey', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    act(() => result.current.setToken('tok'));
    const k0 = result.current.refreshKey;
    act(() => result.current.retry());
    expect(result.current.token).toBeNull();
    expect(result.current.verified).toBe(false);
    expect(result.current.refreshKey).toBe(k0 + 1);
  });

  it('onError sets error and logs', () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    act(() => result.current.onError('captcha failed'));
    expect(result.current.error).toBe('captcha failed');
    expect(addLog).toHaveBeenCalledWith('error', 'captcha failed', expect.any(Object));
  });

  it('refreshAndWait is a function that returns a promise', async () => {
    const { result } = renderHook(() => useCaptcha({ addLog }));
    expect(typeof result.current.refreshAndWait).toBe('function');
    // when no token, it will eventually resolve to boolean (false after timeout if no token)
    // we just verify it does not throw when called and returns a promise
    const p = result.current.refreshAndWait();
    expect(p).toBeInstanceOf(Promise);
    // do not await full 10s timeout; just verify promise exists and handle quickly by setting token
    act(() => result.current.setToken('fresh'));
    // allow effect to sync tokenRef
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
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
