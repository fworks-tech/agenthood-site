import { describe, it, expect, vi } from 'vitest'
import { createEngineState, type EngineCtx } from '../app/(main)/studio/_lib/workspace-engine'
import { startRun, intervene, resumePending, resumeAfterNudge } from '../app/(main)/studio/_lib/workspace-runs'

function mockEngine(memberIds: string[], script: string[] = []) {
  const routes: { from: string; to: string }[] = []
  const notes: string[] = []
  const bubbles: string[] = []
  const handoffs: { memberId: string; reason: string }[] = []
  const turns: { member: string; task: string }[] = []
  const queue = [...script]
  const ctx: EngineCtx = {
    streamTurn: vi.fn(async (m: string, t: string) => {
      turns.push({ member: m, task: t })
      return queue.length > 0 ? (queue.shift() as string) : 'plain output'
    }),
    runSynthesis: vi.fn(async () => 'syn'),
    pushRoute: vi.fn((r) => {
      routes.push(r)
    }),
    pushNote: vi.fn((c: string) => {
      notes.push(c)
    }),
    pushUserBubble: vi.fn((c: string) => {
      bubbles.push(c)
    }),
    showHandoff: vi.fn((memberId: string, reason: string) => {
      handoffs.push({ memberId, reason })
    }),
    clearHandoff: vi.fn(),
    setRunning: vi.fn(),
    setDone: vi.fn(),
    fail: vi.fn(),
    pauseOnAbort: vi.fn(),
    requestStop: vi.fn(),
    requestReset: vi.fn(),
    notify: vi.fn(),
    displayName: (id: string) => id,
    getSpec: () => ({ memberIds, instruction: 'goal' }),
    scheduleNudge: vi.fn(),
    clearNudge: vi.fn(),
    isAborted: () => false,
    isCurrentSession: () => true,
    onNudge: vi.fn(),
  }
  return { ctx, routes, notes, bubbles, handoffs, turns }
}

const RUN = { wId: 'ws-1', correlationId: 'c-1', session: 1 }

describe('startRun', () => {
  it('answers empty pings and leading slashes inline', async () => {
    const ids = ['the-builder']
    const s1 = createEngineState(30)
    const m1 = mockEngine(ids)
    await startRun(s1, { memberIds: ids, instruction: '...' }, RUN.wId, RUN.correlationId, RUN.session, m1.ctx)
    expect(m1.ctx.streamTurn).not.toHaveBeenCalled()
    expect(m1.notes[0]).toContain('looks empty')
    expect(m1.ctx.setDone).toHaveBeenCalled()

    const s2 = createEngineState(30)
    const m2 = mockEngine(ids)
    await startRun(s2, { memberIds: ids, instruction: '/summarize' }, RUN.wId, RUN.correlationId, RUN.session, m2.ctx)
    expect(m2.ctx.streamTurn).not.toHaveBeenCalled()
    expect(m2.notes[0]).toContain('Start with an instruction first')
  })

  it('fails unknown mentions without LLM', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx } = mockEngine(ids)
    await startRun(state, { memberIds: ids, instruction: 'hi @the-ghost' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(ctx.streamTurn).not.toHaveBeenCalled()
    expect(ctx.fail).toHaveBeenCalled()
  })

  it('queues direct mentions at full confidence and runs them', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, routes, turns } = mockEngine(ids, ['did the work', 'no plan'])
    await startRun(state, { memberIds: ids, instruction: 'hey @the-builder build it' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(routes[0]).toMatchObject({ from: 'user', to: 'the-builder', confidence: 100 })
    expect(turns[0].member).toBe('the-builder')
    expect(ctx.runSynthesis).not.toHaveBeenCalled()
    expect(ctx.setDone).toHaveBeenCalled()
  })

  it('plans via the mediator and falls back to the full team', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, turns } = mockEngine(ids, ['{"members":[{"id":"the-builder","task":"code it","order":0}]}', 'coded', 'no plan'])
    await startRun(state, { memberIds: ids, instruction: 'build a bot' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns[0].member).toBe('the-mediator')
    expect(turns[1]).toMatchObject({ member: 'the-builder', task: 'code it' })

    const s2 = createEngineState(30)
    const m2 = mockEngine(ids, ['prose, no JSON', 'a-work', 'b-work', 'no plan'])
    await startRun(s2, { memberIds: ids, instruction: 'build a bot' }, RUN.wId, RUN.correlationId, RUN.session, m2.ctx)
    expect(m2.turns[1].member).toBe('the-architect')
    expect(m2.turns[2].member).toBe('the-builder')
  })

  it('pauses when the unplannable mediator asks the user instead of falling back', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs, turns } = mockEngine(ids, ['Vague goal. Want me to start with the Strategist?'])
    await startRun(state, { memberIds: ids, instruction: 'build a bot for chat' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns).toHaveLength(1)
    expect(state.queue).toHaveLength(0)
    expect(handoffs[0].memberId).toBe('the-mediator')
    expect(handoffs[0].reason).toContain('Want me to start with the Strategist?')
    expect(ctx.setDone).not.toHaveBeenCalled()
  })

  it('pauses on abort instead of failing', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx } = mockEngine(ids)
    ctx.streamTurn = vi.fn(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    await startRun(state, { memberIds: ids, instruction: 'hey @the-builder go' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(ctx.pauseOnAbort).toHaveBeenCalled()
    expect(ctx.fail).not.toHaveBeenCalled()
  })
})

describe('intervene', () => {
  it('handles empty pings with thread context and no LLM', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx, bubbles } = mockEngine(ids)
    await intervene(state, '...', 'ws-1', 'c-1', 1, ctx)
    expect(ctx.streamTurn).not.toHaveBeenCalled()
    expect(bubbles).toEqual(['...'])
    expect(state.thread).toEqual([{ role: 'user', content: '...' }])
    expect(ctx.setDone).toHaveBeenCalled()
  })

  it('runs local commands without touching the thread', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    state.thread = [{ role: 'user', content: 'goal' }]
    const { ctx, bubbles } = mockEngine(ids)
    await intervene(state, '/help', 'ws-1', 'c-1', 1, ctx)
    expect(ctx.streamTurn).not.toHaveBeenCalled()
    expect(bubbles).toEqual(['/help'])
    expect(state.thread).toHaveLength(1)
  })

  it('routes direct mentions and re-plans otherwise', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, turns } = mockEngine(ids, ['built it', 'no plan'])
    await intervene(state, '@the-builder go', 'ws-1', 'c-1', 1, ctx)
    expect(turns[0].member).toBe('the-builder')

    const s2 = createEngineState(30)
    const m2 = mockEngine(ids, ['{"members":[{"id":"the-architect","task":"design","order":0}]}', 'designed', 'no plan'])
    await intervene(s2, 'what now', 'ws-1', 'c-1', 1, m2.ctx)
    expect(m2.turns[0].member).toBe('the-mediator')
    expect(m2.turns[1]).toMatchObject({ member: 'the-architect', task: 'design' })
  })

  it('pauses when the re-plan asks the user instead of guessing', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs, turns } = mockEngine(ids, ['Not sure yet. Want me to dig deeper first?'])
    await intervene(state, 'what now', 'ws-1', 'c-1', 1, ctx)
    expect(turns).toHaveLength(1)
    expect(state.queue).toHaveLength(0)
    expect(handoffs[0].memberId).toBe('the-mediator')
    expect(ctx.setDone).not.toHaveBeenCalled()
  })

  it('blocks the planned team when the mediator also asks the user', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs, turns } = mockEngine(ids, [
      '{"members":[{"id":"the-architect","task":"plan it","order":0}]} Do you already have the API key, @user?',
    ])
    await startRun(state, { memberIds: ids, instruction: 'build a bot' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns).toHaveLength(1)
    expect(turns[0].member).toBe('the-mediator')
    expect(state.queue).toHaveLength(0)
    expect(state.awaiting).toEqual({ memberId: 'the-mediator' })
    expect(handoffs[0].memberId).toBe('the-mediator')
    expect(ctx.setDone).not.toHaveBeenCalled()
  })

  it('routes a reply back to the awaiting owner before anyone else', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    state.awaiting = { memberId: 'the-architect' }
    state.paused = true
    state.queue = [{ id: 'the-builder', task: 'stale plan' }]
    const { ctx, turns } = mockEngine(ids, ['Thanks, continuing the plan.', 'no plan'])
    await intervene(state, 'yes, i have the key', 'ws-1', 'c-1', 1, ctx)
    expect(turns[0].member).toBe('the-architect')
    expect(turns[0].task).toContain('yes, i have the key')
    expect(state.awaiting).toBeNull()
  })

  it('honors conversational mediator delegation without JSON', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, turns } = mockEngine(ids, [
      'Got it — talk to the-builder for the implementation.',
      'built it',
      'no plan',
    ])
    await startRun(state, { memberIds: ids, instruction: 'build a bot' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns[0].member).toBe('the-mediator')
    expect(turns[1].member).toBe('the-builder')
    expect(state.queue).toHaveLength(0)
  })

  it('ignores mediator delegation to members outside the workspace', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, turns } = mockEngine(ids, [
      'Got it — talk to the-auditor for a security pass.',
      'a-work',
      'b-work',
      'no plan',
    ])
    await startRun(state, { memberIds: ids, instruction: 'build a bot' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns[0].member).toBe('the-mediator')
    expect(turns[1].member).toBe('the-architect')
  })

  it('mirrors autonomous reactions into the shared thread', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    const { ctx, turns } = mockEngine(ids, [
      'Got it — talk to the-builder for the implementation.',
      'Deployed ```js\nok\n```',
      'no plan',
    ])
    await startRun(state, { memberIds: ids, instruction: 'build a bot' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns[1].member).toBe('the-builder')
    const reactionLines = state.thread.filter((m) => m.content.startsWith('[reaction]'))
    expect(reactionLines.length).toBeGreaterThan(0)
    expect(reactionLines[0].content).toContain('the-architect')
    expect(reactionLines[0].content).toContain('🎉')
  })

  it('keeps user intent in the thread across a long session', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    state.thread = [{ role: 'user', content: 'build the thing' }]
    const { ctx } = mockEngine(ids, ['work'])
    await startRun(state, { memberIds: ids, instruction: 'build the thing' }, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(state.thread[0].content).toBe('build the thing')
  })
})

describe('resumePending and resumeAfterNudge', () => {
  it('resumes the paused proposal and settles', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    state.pendingRoute = { id: 'the-builder', task: 'go on', confidence: 60 }
    state.paused = true
    const { ctx, turns } = mockEngine(ids, ['finished', 'no plan'])
    await resumePending(state, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(ctx.setRunning).toHaveBeenCalled()
    expect(turns[0]).toMatchObject({ member: 'the-builder', task: 'go on' })
    expect(state.pendingRoute).toBeNull()
    expect(ctx.runSynthesis).not.toHaveBeenCalled()
  })

  it('resolves nudge turns terminally without re-pausing', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx } = mockEngine(ids, ['proceeding alone @user again?'])
    await resumeAfterNudge(state, 'the-builder', 'proceed alone', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(state.awaiting).toBeNull()
    expect(ctx.setDone).toHaveBeenCalled()
  })
})
