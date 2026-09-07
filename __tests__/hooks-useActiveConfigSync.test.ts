/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useActiveConfigSync } from '@/app/(main)/studio/_hooks/useActiveConfigSync'
import type { Conversation } from '@/app/(main)/studio/_hooks/useStudioChat'
import type { ChatConfig } from '@/app/(main)/studio/_types/studio'

const base: ChatConfig = {
  provider: 'opencode-go',
  model: 'mimo-v2.5',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: 'DEFAULT',
}
const conv = (id: string, agentId: string, prompt: string): Conversation => ({
  id,
  agentId,
  title: id,
  messages: [],
  config: { systemPrompt: prompt },
  createdAt: 1,
  tokenCount: 0,
})
const lastUpdater = (setConfig: ReturnType<typeof vi.fn>) =>
  setConfig.mock.calls[setConfig.mock.calls.length - 1][0] as (p: ChatConfig) => ChatConfig

describe('useActiveConfigSync', () => {
  it("aligns the system prompt to the active conversation on mount", () => {
    const setConfig = vi.fn()
    const conversations = [conv('c1', 'the-scribe', 'SCRIBE'), conv('c2', 'the-architect', 'ARCH')]
    renderHook(() => useActiveConfigSync(conversations, 'c1', setConfig))
    expect(lastUpdater(setConfig)(base).systemPrompt).toBe('SCRIBE')
  })

  it('re-syncs when switching to another agent conversation', () => {
    const setConfig = vi.fn()
    const conversations = [conv('c1', 'the-scribe', 'SCRIBE'), conv('c2', 'the-architect', 'ARCH')]
    const { rerender } = renderHook(
      ({ activeId }: { activeId: string | null }) =>
        useActiveConfigSync(conversations, activeId, setConfig),
      { initialProps: { activeId: 'c1' as string | null } },
    )
    rerender({ activeId: 'c2' })
    expect(lastUpdater(setConfig)(base).systemPrompt).toBe('ARCH')
  })

  it('does not clobber config on unrelated conversation updates (same active id)', () => {
    const setConfig = vi.fn()
    const initial = [conv('c1', 'the-scribe', 'SCRIBE')]
    const { rerender } = renderHook(
      ({ convs }: { convs: Conversation[] }) => useActiveConfigSync(convs, 'c1', setConfig),
      { initialProps: { convs: initial } },
    )
    const afterMount = setConfig.mock.calls.length
    rerender({ convs: [...initial, conv('c9', 'the-builder', 'BUILDER')] })
    expect(setConfig.mock.calls.length).toBe(afterMount)
  })

  it('does nothing when there is no active conversation', () => {
    const setConfig = vi.fn()
    renderHook(() => useActiveConfigSync([conv('c1', 'the-scribe', 'SCRIBE')], null, setConfig))
    expect(setConfig).not.toHaveBeenCalled()
  })
})
