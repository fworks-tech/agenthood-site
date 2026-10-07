/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkspace } from '../app/(main)/studio/_hooks/useWorkspace'

type TurnScript = { text: string } | { hang: true }

function sse(events: Record<string, unknown>[]): Response {
  const text = events.map((e) => JSON.stringify(e) + '\n').join('')
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(text))
      c.close()
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}

function turnEvents(memberId: string, text: string): Record<string, unknown>[] {
  return [
    { type: 'workspace.turn_start', memberId, role: memberId, turnIndex: 1, workspaceId: 'w', correlationId: 'c' },
    { type: 'workspace.status', memberId, status: 'working', workspaceId: 'w', correlationId: 'c' },
    { type: 'workspace.token', memberId, data: text, workspaceId: 'w', correlationId: 'c' },
    { type: 'workspace.turn_end', memberId, decision: 'pass', workspaceId: 'w', correlationId: 'c' },
    { type: 'workspace.status', memberId, status: 'done', workspaceId: 'w', correlationId: 'c' },
  ]
}

function planOf(members: { id: string; task: string }[]): string {
  return JSON.stringify({ members: members.map((m, i) => ({ ...m, order: i })) })
}

type Call = { url: string; body: { memberId?: string; instruction?: string; thread?: { role: string; content: string }[] } }

function installFetch(turns: TurnScript[], synthText: string | null) {
  const calls: Call[] = []
  let i = 0
  const fn = vi.fn(async (url: string, init: { body?: string; signal?: AbortSignal }) => {
    const body = JSON.parse(init.body ?? '{}')
    calls.push({ url, body })
    if (url.includes('/synthesize')) {
      if (synthText === null) return new Response('err', { status: 500 })
      return sse([
        { type: 'workspace.synthesized', data: synthText, workspaceId: 'w', correlationId: 'c' },
        { type: 'workspace.synthesized_end', workspaceId: 'w', correlationId: 'c' },
      ])
    }
    const t = turns[Math.min(i++, turns.length - 1)]
    if ('hang' in t) {
      await new Promise((_res, rej) => {
        if (init.signal?.aborted) rej(new DOMException('aborted', 'AbortError'))
        else init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
      })
      throw new DOMException('aborted', 'AbortError')
    }
    return sse(turnEvents(body.memberId as string, t.text))
  })
  vi.stubGlobal('fetch', fn)
  return calls
}

const tick = async (n = 8) => {
  for (let k = 0; k < n; k++) await new Promise((r) => setTimeout(r, 5))
}

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useWorkspace chain engine', () => {
  it('stops an in-flight turn and leaves no work behind', async () => {
    const calls = installFetch([{ text: planOf([{ id: 'the-builder', task: 'build' }]) }, { hang: true }], null)
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      const p = result.current.start({ memberIds: ['the-builder'], instruction: 'go' })
      await tick()
      result.current.stop()
      await p
    })
    expect(result.current.workspaceState).toBe('done')
    expect(calls.filter((c) => !c.url.includes('/synthesize'))).toHaveLength(2)
    expect(calls.some((c) => c.url.includes('/synthesize'))).toBe(false)
  })

  it('pauses on a 60% route and resumes via typed /continue with the hint preserved', async () => {
    const calls = installFetch(
      [
        { text: planOf([{ id: 'the-librarian', task: 'write docs' }]) },
        { text: 'All docs finished.' },
        { text: planOf([{ id: 'the-builder', task: 'verify snippets' }]) },
        { text: 'Snippets verified ```js\nok\n```' },
        { text: '' },
      ],
      null,
    )
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      await result.current.start({ memberIds: ['the-librarian', 'the-builder'], instruction: 'go' })
    })
    expect(result.current.workspaceState).toBe('handoff')
    expect(result.current.handoff?.memberId).toBe('the-builder')
    expect(result.current.handoff?.reason).toMatch(/60%/)

    await act(async () => {
      await result.current.sendIntervention('/continue with retries')
    })
    const builderCalls = calls.filter((c) => c.body.memberId === 'the-builder')
    expect(builderCalls).toHaveLength(1)
    expect(builderCalls[0].body.instruction).toMatch(/User hint: with retries/)
    expect(result.current.workspaceState).toBe('done')
  })

  it('pauses for @user, nudges once after 90s, then settles alone', async () => {
    vi.useFakeTimers()
    const calls = installFetch(
      [
        { text: planOf([{ id: 'the-builder', task: 'deploy' }]) },
        { text: '@user which region? ```js\npick\n```' },
        { text: 'Proceeding in us-east-1 ```js\nok\n```' },
        { text: '' },
      ],
      null,
    )
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      await result.current.start({ memberIds: ['the-builder'], instruction: 'go' })
    })
    expect(result.current.workspaceState).toBe('handoff')
    expect(result.current.handoff?.reason).toMatch(/which region/)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000)
    })
    const nudges = calls.filter((c) => (c.body.instruction ?? '').includes('has not replied'))
    expect(nudges).toHaveLength(1)
    expect(result.current.workspaceState).toBe('done')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000)
    })
    expect(calls.filter((c) => (c.body.instruction ?? '').includes('has not replied'))).toHaveLength(1)
  })

  it('cancels the nudge when the user replies in time', async () => {
    vi.useFakeTimers()
    const calls = installFetch(
      [
        { text: planOf([{ id: 'the-builder', task: 'deploy' }]) },
        { text: '@user which region? ```js\npick\n```' },
        { text: planOf([{ id: 'the-builder', task: 'follow up' }]) },
        { text: 'Done ```js\nok\n```' },
        { text: '' },
      ],
      null,
    )
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      await result.current.start({ memberIds: ['the-builder'], instruction: 'go' })
    })
    expect(result.current.workspaceState).toBe('handoff')

    await act(async () => {
      await result.current.sendIntervention('us-east-1')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000)
    })
    expect(calls.some((c) => (c.body.instruction ?? '').includes('has not replied'))).toBe(false)
    expect(result.current.workspaceState).toBe('done')
  })

  it('keeps /summarize out of the synthesis thread but shows the bubble', async () => {
    const calls = installFetch(
      [
        { text: planOf([{ id: 'the-builder', task: 'build' }]) },
        { text: 'Built ```js\nok\n```' },
        { text: '' },
      ],
      null,
    )
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      await result.current.start({ memberIds: ['the-builder'], instruction: 'go' })
    })
    // Reinstall to capture the synthesis request body cleanly.
    const calls2 = installFetch([{ text: 'unused' }], 'final answer here')
    await act(async () => {
      await result.current.sendIntervention('/summarize')
    })
    const synth = calls2.find((c) => c.url.includes('/synthesize'))
    expect(synth).toBeDefined()
    expect(synth!.body.thread?.some((m) => m.content.includes('/summarize'))).toBe(false)
    expect(result.current.messages.some((m) => m.memberId === 'user' && m.content === '/summarize')).toBe(true)
    expect(result.current.messages.some((m) => m.memberId === 'synthesizer' && m.content.includes('final answer'))).toBe(true)
    expect(calls).toBeDefined()
  })

  it('caps a long plan at 8 hops', async () => {
    // Alternate members so the triple-repeat guard cannot fire first —
    // this isolates the hop cap.
    const members = Array.from({ length: 10 }, (_, k) => ({
      id: k % 2 === 0 ? 'the-builder' : 'the-tester',
      task: 'work',
    }))
    const turns: TurnScript[] = [{ text: planOf(members) }]
    for (let k = 0; k < 10; k++) turns.push({ text: `Work item ${k} \`\`\`js\nx\n\`\`\`` })
    const calls = installFetch(turns, null)
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      await result.current.start({ memberIds: ['the-builder', 'the-tester'], instruction: 'go' })
    })
    expect(calls.filter((c) => c.body.memberId === 'the-builder' || c.body.memberId === 'the-tester')).toHaveLength(8)
    expect(result.current.workspaceState).toBe('done')
  })

  it('stops on a triple repeat and on a blocking signal', async () => {
    const calls = installFetch(
      [
        { text: planOf([{ id: 'the-builder', task: 'a' }, { id: 'the-builder', task: 'b' }, { id: 'the-builder', task: 'c' }]) },
        { text: 'ok ```js\n1\n```' },
        { text: 'ok ```js\n2\n```' },
        { text: 'ok ```js\n3\n```' },
      ],
      null,
    )
    const { result } = renderHook(() => useWorkspace())
    await act(async () => {
      await result.current.start({ memberIds: ['the-builder'], instruction: 'go' })
    })
    expect(calls.filter((c) => c.body.memberId === 'the-builder')).toHaveLength(3)

    const calls2 = installFetch(
      [{ text: planOf([{ id: 'the-builder', task: 'a' }, { id: 'the-builder', task: 'b' }]) }, { text: 'Blocking issue in auth ```js\nx\n```' }],
      null,
    )
    const second = renderHook(() => useWorkspace())
    await act(async () => {
      await second.result.current.start({ memberIds: ['the-builder'], instruction: 'go again' })
    })
    expect(calls2.filter((c) => c.body.memberId === 'the-builder')).toHaveLength(1)
    expect(second.result.current.workspaceState).toBe('done')
  })
})
