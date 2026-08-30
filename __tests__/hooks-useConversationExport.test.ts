/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConversationExport } from '../app/(main)/studio/_hooks/useConversationExport';

vi.mock('../app/(main)/studio/_lib/export-conversation', async () => {
  const actual = await vi.importActual<typeof import('../app/(main)/studio/_lib/export-conversation')>(
    '../app/(main)/studio/_lib/export-conversation',
  );
  return {
    ...actual,
    downloadBlob: vi.fn(),
  };
});

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

import { downloadBlob } from '../app/(main)/studio/_lib/export-conversation';
import { track } from '@vercel/analytics';

describe('useConversationExport', () => {
  const conversations: any = [
    {
      id: 'conv-1',
      agentId: 'the-scribe',
      title: 'Test conversation',
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
      config: { provider: 'opencode-go', model: 'x' },
      createdAt: 0,
      tokenCount: 0,
    },
  ];
  const addLog = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('exports json and md via downloadBlob and track', () => {
    const { result } = renderHook(() =>
      useConversationExport({ conversations, activeConversationId: 'conv-1', addLog }),
    );
    act(() => result.current.handleExport('json'));
    expect(downloadBlob).toHaveBeenCalledWith(expect.stringContaining('.json'), 'application/json', expect.any(String));
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('JSON'));
    expect(track).toHaveBeenCalledWith('conversation_exported', expect.objectContaining({ format: 'json' }));

    act(() => result.current.handleExport('md'));
    expect(downloadBlob).toHaveBeenCalledWith(expect.stringContaining('.md'), 'text/markdown', expect.any(String));
    expect(track).toHaveBeenCalledWith('conversation_exported', expect.objectContaining({ format: 'md' }));
  });

  it('is no-op when no active conversation', () => {
    const { result } = renderHook(() =>
      useConversationExport({ conversations, activeConversationId: null, addLog }),
    );
    act(() => result.current.handleExport('json'));
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('is no-op when active id not found', () => {
    const { result } = renderHook(() =>
      useConversationExport({ conversations, activeConversationId: 'missing', addLog }),
    );
    act(() => result.current.handleExport('md'));
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
