/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogs } from '../app/(main)/studio/_hooks/useLogs';

function mockSessionStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    },
    configurable: true,
  });
  return store;
}

describe('useLogs', () => {
  beforeEach(() => {
    mockSessionStorage();
    vi.clearAllMocks();
  });

  it('initializes with empty logs and addLog appends', async () => {
    const { result } = renderHook(() => useLogs());
    expect(result.current.logs).toEqual([]);
    act(() => {
      result.current.addLog('info', 'hello', { category: 'system' });
    });
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0].message).toBe('hello');
  });

  it('handleNetworkLog formats StreamLogEvent', async () => {
    const { result } = renderHook(() => useLogs());
    act(() => {
      result.current.handleNetworkLog({ level: 'info', event: 'chat.response', status: 200 } as any);
    });
    expect(result.current.logs[0].message).toContain('chat.response');
    expect(result.current.logs[0].message).toContain('status=200');
    expect(result.current.logs[0].category).toBe('network');
  });

  it('auto-opens logs on new error when closed', async () => {
    const { result } = renderHook(() => useLogs());
    // close logs
    act(() => result.current.setLogsOpen(false));
    expect(result.current.logsOpen).toBe(false);
    act(() => result.current.addLog('error', 'boom', { category: 'network' }));
    // effect should reopen
    expect(result.current.logsOpen).toBe(true);
  });

  it('toggles debug and category and persists to sessionStorage', async () => {
    const store = mockSessionStorage();
    const { result } = renderHook(() => useLogs());
    act(() => result.current.setDebugVisible(true));
    expect(window.sessionStorage.getItem('agenthood-studio-logs-debug')).toBe('1');
    act(() => result.current.setLogCategoryFilter('network'));
    expect(window.sessionStorage.getItem('agenthood-studio-logs-category')).toBe('network');
  });
});
