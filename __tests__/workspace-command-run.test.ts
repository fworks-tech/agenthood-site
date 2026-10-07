import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runWorkspaceCommand, type CommandCtx } from '../app/(main)/studio/_lib/workspace-command-run'

function mockCtx(over: Partial<CommandCtx> = {}): CommandCtx & { pushed: string[]; pumped: number; settled: number; turns: string[] } {
  const pushed: string[] = []
  const pumped: number[] = []
  const settled: number[] = []
  const turns: string[] = []
  return {
    pushed,
    pumped: pumped.length,
    settled: settled.length,
    turns,
    takeTurn: vi.fn(async (m: string) => {
      turns.push(m)
      return `out-from-${m}`
    }),
    pump: vi.fn(async () => {
      pumped.push(1)
    }),
    settle: vi.fn(async () => {
      settled.push(1)
    }),
    afterTurn: vi.fn(async () => 'done' as const),
    runSynthesis: vi.fn(async () => 'syn'),
    pushCommand: vi.fn((c: string) => {
      pushed.push(c)
    }),
    stop: vi.fn(),
    reset: vi.fn(),
    setRunning: vi.fn(),
    getSpec: () => ({ memberIds: ['the-builder'], instruction: 'goal' }),
    getLastTurn: () => null,
    takePending: () => null,
    enqueue: vi.fn(),
    appendThreadUser: vi.fn(),
    isCurrentSession: () => true,
    ...over,
  } as unknown as CommandCtx & { pushed: string[]; pumped: number; settled: number; turns: string[] }
}

const RUN = { wId: 'ws-1', correlationId: 'c-1', session: 1 }

describe('runWorkspaceCommand', () => {
  let ctx: ReturnType<typeof mockCtx>
  beforeEach(() => {
    ctx = mockCtx()
  })

  it('routes stop/new without LLM', async () => {
    expect(await runWorkspaceCommand({ name: 'stop', args: '' }, RUN, ctx)).toBe('handled')
    expect(ctx.stop).toHaveBeenCalled()
    expect(await runWorkspaceCommand({ name: 'new', args: '' }, RUN, ctx)).toBe('handled')
    expect(ctx.reset).toHaveBeenCalled()
    expect(ctx.takeTurn).not.toHaveBeenCalled()
  })

  it('answers unknown commands inline', async () => {
    expect(await runWorkspaceCommand({ name: 'frobnicate', args: '', unknown: true }, RUN, ctx)).toBe('handled')
    expect(ctx.takeTurn).not.toHaveBeenCalled()
    expect(ctx.pushed.join()).toMatch(/\/help/)
  })

  it('summarizes without touching the thread turns', async () => {
    expect(await runWorkspaceCommand({ name: 'summarize', args: '' }, RUN, ctx)).toBe('handled')
    expect(ctx.runSynthesis).toHaveBeenCalledWith('ws-1', 'c-1')
    expect(ctx.takeTurn).not.toHaveBeenCalled()
  })

  it('retries the last turn and settles', async () => {
    ctx = mockCtx({ getLastTurn: () => ({ memberId: 'the-builder', task: 't', raw: 'r' }) })
    expect(await runWorkspaceCommand({ name: 'retry', args: '' }, RUN, ctx)).toBe('handled')
    expect(ctx.turns).toEqual(['the-builder'])
    expect(ctx.settle).toHaveBeenCalled()
  })

  it('says so when there is nothing to retry', async () => {
    expect(await runWorkspaceCommand({ name: 'retry', args: '' }, RUN, ctx)).toBe('handled')
    expect(ctx.takeTurn).not.toHaveBeenCalled()
    expect(ctx.pushed.join()).toMatch(/Nothing to retry/)
  })

  it('resumes a paused ask-inline without re-running the turn', async () => {
    ctx = mockCtx({ takePending: () => ({ id: 'the-builder', task: 't', confidence: 62 }) })
    expect(await runWorkspaceCommand({ name: 'continue', args: 'hurry' }, RUN, ctx)).toBe('handled')
    expect(ctx.takeTurn).not.toHaveBeenCalled()
    expect(ctx.enqueue).toHaveBeenCalledWith({ id: 'the-builder', task: expect.stringContaining('hurry') })
    expect(ctx.settle).toHaveBeenCalled()
  })

  it('renders help with the roster and no LLM', async () => {
    expect(await runWorkspaceCommand({ name: 'help', args: '' }, RUN, ctx)).toBe('handled')
    expect(ctx.takeTurn).not.toHaveBeenCalled()
    expect(ctx.pushed.join()).toMatch(/@the-builder/)
  })
})
