/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSendMessage } from '../app/(main)/studio/_hooks/useSendMessage';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
import { track } from '@vercel/analytics';

describe('useSendMessage', () => {
  const addLog = vi.fn();
  let chat: any;
  let captcha: any;
  const selectedAgent: any = { id: 'the-builder', name: 'Builder', icon: '🔨' };
  const config: any = { provider: 'opencode-go', model: 'm' };
  const baseOptions = () => ({
    chat,
    selectedAgent,
    config,
    activeConversationId: 'conv-1',
    captcha,
    addLog,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    chat = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      retrySendMessage: vi.fn().mockResolvedValue(undefined),
      totalTokens: 42,
    };
    captcha = {
      isRequired: true,
      tokenRef: { current: 'tok' },
      refreshAndWait: vi.fn().mockResolvedValue(true),
      onError: vi.fn(),
    };
  });

  it('blocks the send when captcha is required but no token is ready', async () => {
    captcha.tokenRef.current = null;
    const { result } = renderHook(() => useSendMessage(baseOptions()));
    await act(async () => {
      await result.current.handleSendMessage('hi');
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(addLog).toHaveBeenCalledWith('warn', expect.stringContaining('not ready yet'), expect.objectContaining({ category: 'captcha' }));
  });

  it('sends with the token and logs completion', async () => {
    const { result } = renderHook(() => useSendMessage(baseOptions()));
    await act(async () => {
      await result.current.handleSendMessage('hi');
    });
    expect(chat.sendMessage).toHaveBeenCalledWith('hi', 'tok');
    expect(track).toHaveBeenCalledWith('message_sent', expect.objectContaining({ agentId: 'the-builder' }));
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('completed'));
    expect(track).toHaveBeenCalledWith('message_completed', expect.objectContaining({ tokenCount: 42 }));
  });

  it('refreshes captcha and retries on CAPTCHA_FAILED', async () => {
    chat.sendMessage.mockRejectedValue(Object.assign(new Error('consumed'), { code: 'CAPTCHA_FAILED' }));
    captcha.tokenRef.current = 'fresh-tok';
    const { result } = renderHook(() => useSendMessage(baseOptions()));
    await act(async () => {
      await result.current.handleSendMessage('hi');
    });
    expect(captcha.refreshAndWait).toHaveBeenCalled();
    expect(chat.retrySendMessage).toHaveBeenCalledWith('hi', 'fresh-tok');
    expect(addLog).toHaveBeenCalledWith('info', expect.stringContaining('(retry)'));
  });
});
