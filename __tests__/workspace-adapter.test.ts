import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockComplete, mockStream, mockSetModel, mockFromConfig, mockExecuteTool, mockClassify } = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockStream: vi.fn(),
  mockSetModel: vi.fn(),
  mockFromConfig: vi.fn(),
  mockExecuteTool: vi.fn(),
  mockClassify: vi.fn(),
}))

vi.mock('agenthood/dist/llm', () => ({
  LLMRouter: {
    fromConfig: mockFromConfig,
  },
}))

vi.mock('../app/(main)/studio/_data/agents.generated', () => ({
  agentSkills: {
    'the-builder': 'You are the-builder system prompt.',
    'the-mediator': 'You are the-mediator.',
    'the-tester': 'You are the-tester.',
  },
}))

vi.mock('../app/(main)/studio/_lib/tools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/(main)/studio/_lib/tools')>()
  return {
    ...actual,
    executeTool: mockExecuteTool,
    classifyToolResult: mockClassify,
    getToolSchemas: () => [
      { name: 'web_fetch', description: 'fetch', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
      { name: 'code_execution', description: 'code', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
    ],
    MAX_TOOL_ITERATIONS: 5,
  }
})

import { createWorkspaceTurnStream } from '../app/(main)/studio/_lib/workspace-adapter'

function setupProvider(opts: { complete?: unknown; stream?: unknown } = {}) {
  const provider = {
    setModel: mockSetModel,
    complete: mockComplete,
    stream: mockStream,
  }
  mockFromConfig.mockResolvedValue(provider)
  if (opts.complete !== undefined) mockComplete.mockResolvedValue(opts.complete)
  if (opts.stream !== undefined) mockStream.mockResolvedValue(opts.stream)
  return provider
}

async function collectEvents(stream: ReadableStream): Promise<Record<string, unknown>[]> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const events: Record<string, unknown>[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (value) buf += decoder.decode(value, { stream: true })
    if (done) {
      if (buf) {
        for (const line of buf.split('\n').filter(Boolean)) {
          try { events.push(JSON.parse(line)) } catch {}
        }
      }
      break
    }
    const parts = buf.split('\n')
    buf = parts.pop() ?? ''
    for (const line of parts) {
      if (!line.trim()) continue
      try { events.push(JSON.parse(line)) } catch {}
    }
  }
  return events
}

beforeEach(() => {
  vi.resetAllMocks()
  mockComplete.mockReset()
  mockStream.mockReset()
  mockSetModel.mockReset()
  mockFromConfig.mockReset()
  mockExecuteTool.mockResolvedValue('tool ok')
  mockClassify.mockReturnValue({ result: 'tool ok' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createWorkspaceTurnStream', () => {
  it('throws for unknown memberId', async () => {
    await expect(
      createWorkspaceTurnStream({
        workspaceId: 'ws-1',
        correlationId: 'corr-1',
        memberId: 'unknown-agent',
        instruction: 'hi',
        thread: [],
        turnIndex: 0,
      }),
    ).rejects.toThrow('No system prompt')
  })

  it('emits turn_start and status working', async () => {
    setupProvider({ complete: { content: 'final answer', toolCalls: [] } })
    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-1', correlationId: 'corr-1', memberId: 'the-builder', instruction: 'hello', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    expect(events.some((e) => e.type === 'workspace.turn_start' && e.memberId === 'the-builder')).toBe(true)
    expect(events.some((e) => e.type === 'workspace.status' && e.status === 'working')).toBe(true)
    const tokens = events.filter((e) => e.type === 'workspace.token').map((e) => e.data).join('')
    expect(tokens).toBe('final answer')
    expect(events.some((e) => e.type === 'workspace.turn_end' && e.decision === 'pass')).toBe(true)
    expect(events.some((e) => e.type === 'workspace.status' && e.status === 'done')).toBe(true)
  })

  it('streams tokens in batches when complete returns content', async () => {
    setupProvider({ complete: { content: 'Hi', toolCalls: [] } })
    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-2', correlationId: 'c2', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    const tokens = events.filter((e) => e.type === 'workspace.token').map((e) => e.data)
    expect(tokens.join('')).toBe('Hi')
    // long content is chunked rather than one token per char
    setupProvider({ complete: { content: 'x'.repeat(600), toolCalls: [] } })
    const stream2 = await createWorkspaceTurnStream({
      workspaceId: 'ws-2b', correlationId: 'c2b', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 0,
    })
    const events2 = await collectEvents(stream2)
    const tokens2 = events2.filter((e) => e.type === 'workspace.token').map((e) => e.data)
    expect(tokens2.length).toBeLessThan(600)
    expect(tokens2.join('')).toBe('x'.repeat(600))
  })

  it('falls back to provider.stream when no finalText and no toolCalls', async () => {
    setupProvider({ complete: { content: '', toolCalls: [] } })
    const gen = (async function* () {
      yield { delta: 'streamed ', done: false }
      yield { delta: 'hello', done: true }
    })()
    mockStream.mockResolvedValue(gen as unknown as AsyncGenerator<unknown>)
    mockComplete.mockResolvedValue({ content: '', toolCalls: [] })

    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-3', correlationId: 'c3', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 1,
    })
    const events = await collectEvents(stream)
    const tokens = events.filter((e) => e.type === 'workspace.token').map((e) => e.data).join('')
    expect(tokens).toBe('streamed hello')
  })

  it('emits tool_call and tool_result for web_fetch', async () => {
    mockComplete
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'call_1', name: 'web_fetch', args: { url: 'https://github.com/foo' } }],
      })
      .mockResolvedValueOnce({ content: 'after tools', toolCalls: [] })
    setupProvider({})
    mockFromConfig.mockResolvedValue({ setModel: mockSetModel, complete: mockComplete, stream: mockStream })

    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-4', correlationId: 'c4', memberId: 'the-builder', instruction: 'fetch', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    expect(events.some((e) => e.type === 'workspace.tool_call' && e.name === 'web_fetch')).toBe(true)
    expect(events.some((e) => e.type === 'workspace.tool_result' && e.name === 'web_fetch')).toBe(true)
    expect(mockExecuteTool).toHaveBeenCalledWith('web_fetch', { url: 'https://github.com/foo' }, undefined)
  })

  it('emits handoff for code_execution', async () => {
    mockComplete.mockResolvedValue({
      content: 'run code',
      toolCalls: [{ id: 'call_2', name: 'code_execution', args: { code: '1+1' } }],
    })
    setupProvider({ complete: undefined as unknown as never })
    // need fromConfig to use our mockComplete
    mockFromConfig.mockResolvedValue({ setModel: mockSetModel, complete: mockComplete, stream: mockStream })

    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-5', correlationId: 'c5', memberId: 'the-builder', instruction: 'code', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    const handoff = events.find((e) => e.type === 'workspace.handoff')
    expect(handoff).toBeTruthy()
    expect((handoff as Record<string, unknown>).reason).toContain('code_execution')
    expect((handoff as Record<string, unknown>).options).toEqual(['continue', 'stop'])
  })

  it('classifies error tool result', async () => {
    mockComplete
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'call_3', name: 'web_fetch', args: { url: 'https://github.com/foo' } }],
      })
      .mockResolvedValueOnce({ content: 'done', toolCalls: [] })
    mockExecuteTool.mockResolvedValue('Error: not found')
    mockClassify.mockReturnValue({ error: 'Error: not found' })
    mockFromConfig.mockResolvedValue({ setModel: mockSetModel, complete: mockComplete, stream: mockStream })

    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-6', correlationId: 'c6', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    const toolResult = events.find((e) => e.type === 'workspace.tool_result')
    expect((toolResult as Record<string, unknown>).error).toBe('Error: not found')
  })

  it('handles abort signal early', async () => {
    const controller = new AbortController()
    controller.abort()
    mockComplete.mockResolvedValue({ content: 'hi', toolCalls: [] })
    const emptyGen = (async function* () {})()
    mockStream.mockResolvedValue(emptyGen as unknown as AsyncGenerator<unknown>)
    mockFromConfig.mockResolvedValue({ setModel: mockSetModel, complete: mockComplete, stream: mockStream })

    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-7', correlationId: 'c7', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 0,
    }, controller.signal)
    const events = await collectEvents(stream)
    expect(events.some((e) => e.type === 'workspace.turn_end' && e.decision === 'handoff')).toBe(true)
  })

  it('emits workspace.error on provider failure', async () => {
    mockFromConfig.mockRejectedValue(new Error('provider down'))
    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-8', correlationId: 'c8', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    expect(events.some((e) => e.type === 'workspace.error')).toBe(true)
    const err = events.find((e) => e.type === 'workspace.error') as Record<string, unknown>
    expect(err.data).toContain('provider down')
  })

  it('includes workspaceId and correlationId on trace log events', async () => {
    setupProvider({ complete: { content: 'ok', toolCalls: [] } })
    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-trace', correlationId: 'corr-trace', memberId: 'the-builder', instruction: 'hi', thread: [], turnIndex: 2,
    })
    const events = await collectEvents(stream)
    const logEvents = events.filter((e) => e.type === 'log')
    expect(logEvents.length).toBeGreaterThan(0)
    for (const le of logEvents) {
      expect(le.workspaceId).toBe('ws-trace')
      expect(le.correlationId).toBe('corr-trace')
    }
  })

  it('uses thread when non-empty instead of instruction', async () => {
    setupProvider({ complete: { content: 'thread reply', toolCalls: [] } })
    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-9', correlationId: 'c9', memberId: 'the-builder', instruction: 'original', thread: [{ role: 'user', content: 'from thread' }], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    expect(events.some((e) => e.type === 'workspace.token')).toBe(true)
    // verify complete was called with messages containing 'from thread'
    expect(mockComplete).toHaveBeenCalled()
    const callArgs = mockComplete.mock.calls[0][0]
    expect(JSON.stringify(callArgs.messages)).toContain('from thread')
  })

  it('handles MAX_TOOL_ITERATIONS reached', async () => {
    // every complete returns a tool call, so we hit 5 iterations
    mockComplete.mockResolvedValue({
      content: '',
      toolCalls: [{ id: 'call_x', name: 'web_fetch', args: { url: 'https://github.com/foo' } }],
    })
    mockFromConfig.mockResolvedValue({ setModel: mockSetModel, complete: mockComplete, stream: mockStream })

    const stream = await createWorkspaceTurnStream({
      workspaceId: 'ws-iter', correlationId: 'c10', memberId: 'the-builder', instruction: 'loop', thread: [], turnIndex: 0,
    })
    const events = await collectEvents(stream)
    // should have 5 tool_calls (MAX=5)
    expect(events.filter((e) => e.type === 'workspace.tool_call').length).toBe(5)
  })
})
