import { describe, it, expect, vi } from 'vitest'
import {
  createEngineState,
  engineTakeTurn,
  afterTurn,
  pump,
  settle,
  clearPause,
  resetEngineState,
  findUserQuestion,
  hasUserMention,
  type EngineCtx,
  type EngineState,
} from '../app/(main)/studio/_lib/workspace-engine'

function mockEngine(memberIds: string[], script: string[] = []) {
  const routes: { from: string; to: string; confidence: number }[] = []
  const notes: string[] = []
  const handoffs: { memberId: string; reason: string }[] = []
  const notifies: string[] = []
  const nudges: { ms: number; fire: () => void }[] = []
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
    pushUserBubble: vi.fn(),
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
    notify: vi.fn((b: string) => {
      notifies.push(b)
    }),
    displayName: (id: string) => id,
    getSpec: () => ({ memberIds, instruction: 'goal' }),
    scheduleNudge: vi.fn((ms: number, fire: () => void) => {
      nudges.push({ ms, fire })
    }),
    clearNudge: vi.fn(),
    isAborted: () => false,
    isCurrentSession: () => true,
    onNudge: vi.fn(),
  }
  return { ctx, routes, notes, handoffs, notifies, nudges, turns }
}

const RUN = { wId: 'ws-1', correlationId: 'c-1', session: 1 }

function fresh(ids: string[] = ['the-architect', 'the-builder']): { state: EngineState; ids: string[] } {
  return { state: createEngineState(30), ids }
}

describe('findUserQuestion', () => {
  const ids = ['the-builder', 'the-strategist']
  it('catches the closing ask from the production incident', () => {
    const raw = `Classification: planning goal. So my handoff would be the Strategist, then the Architect.
I'm not going to start refining the goal myself. Want me to hand this off to them? Or if you'd rather just start talking specifics, that's fine too.`
    expect(findUserQuestion(raw, ids)).toContain('Want me to hand this off to them?')
  })

  it('ignores member-directed and rhetorical questions', () => {
    expect(findUserQuestion('Can you review this, the-builder?', ids)).toBeNull()
    expect(findUserQuestion('Should we use X or Y? I picked X.', ids)).toBeNull()
    expect(findUserQuestion('What does done look like?', ids)).toBeNull()
    expect(findUserQuestion('You know what, should we do X?', ids)).toBeNull()
    expect(findUserQuestion('Steady progress, no questions.', ids)).toBeNull()
    expect(findUserQuestion('talk to the-builder — will you take it?', ids)).toBeNull()
  })

  it('prefers the last question but still hears an earlier ask', () => {
    expect(findUserQuestion('Done. Want me to proceed?', ids)).toContain('Want me to proceed?')
    expect(findUserQuestion('Want me to proceed? Should we use X or Y, team?', ids)).toBe('Want me to proceed?')
  })

  it('ignores questions inside fenced and inline code', () => {
    expect(findUserQuestion('Set `your_token` then `cond ? a : b` in config.', ids)).toBeNull()
    expect(findUserQuestion('```js\nconst t = your_token ? a : b\n```\nDone. Want me to proceed?', ids)).toContain(
      'Want me to proceed?',
    )
  })

  it('ignores code in a truncated unclosed fence and keeps prose between fences', () => {
    expect(findUserQuestion('Starting.\n```py\nx = you ? a : b', ids)).toBeNull()
    expect(findUserQuestion('Run ```x``` Want me to proceed? ```y```', ids)).toContain('Want me to proceed?')
  })

  it('skips display-name vocatives but hears asks past passing mentions', () => {
    expect(findUserQuestion('Can you take this, Builder?', ids)).toBeNull()
    expect(findUserQuestion('@builder, can you confirm?', ids)).toBeNull()
    expect(findUserQuestion('talk to Builder about it, will you?', ids)).toBeNull()
    expect(findUserQuestion('The Strategist will dig into this. Want me to hand it off?', ['the-strategist'])).toContain(
      'Want me to hand it off?',
    )
  })

  it('skips sentence-start vocatives, including after an earlier sentence', () => {
    expect(findUserQuestion('Builder, can you confirm?', ids)).toBeNull()
    expect(findUserQuestion('Plan is done. Builder, can you confirm?', ids)).toBeNull()
    expect(findUserQuestion('Hey Builder, can you confirm?', ids)).toBeNull()
    expect(findUserQuestion('Plan is done; the Builder: do you agree?', ids)).toBeNull()
    expect(findUserQuestion('talk to the builder about it, will you?', ids)).toBeNull()
  })

  it('still pauses when a lane word is a noun, not an address', () => {
    expect(findUserQuestion('Builder pattern or a factory — do you want me to pick?', ids)).toContain('want me to pick?')
    expect(findUserQuestion('We keep the builder idea. Do you want to proceed?', ids)).toContain('Do you want to proceed?')
  })
})

describe('afterTurn', () => {
  it('never re-arms awaiting from a mediator fallback on nudge turns', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs, nudges } = mockEngine(ids, ['Hmm. Want me to escalate this?'])
    const r = await afterTurn(state, 'the-builder', 'Proceeding alone with my best guess.', RUN.wId, RUN.correlationId, RUN.session, ctx, {
      nudge: true,
    })
    expect(r).toBe('done')
    expect(state.awaiting).toBeNull()
    expect(handoffs).toHaveLength(0)
    expect(nudges).toHaveLength(0)
  })

  it('pauses on a detected user question exactly like @user', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs, nudges } = mockEngine(ids)
    const r = await afterTurn(state, 'the-builder', 'Made good progress. Want me to keep going with this approach?', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('paused')
    expect(ctx.streamTurn).not.toHaveBeenCalled()
    expect(state.awaiting).toEqual({ memberId: 'the-builder' })
    expect(handoffs[0].reason).toContain('Want me to keep going with this approach?')
    expect(nudges).toHaveLength(1)
  })

  it('keeps routing past rhetorical questions', async () => {
    const { state, ids } = fresh()
    const { ctx } = mockEngine(ids)
    const r = await afterTurn(state, 'the-architect', 'Plan drafted — talk to the-builder for the code. Should we use X or Y? I chose X.', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('continue')
    expect(state.queue[0].id).toBe('the-builder')
  })

  it('pauses when the mediator fallback asks the user', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs } = mockEngine(ids, ['Hmm, hard to route. Want me to bring in outside help?'])
    const r = await afterTurn(state, 'the-builder', 'Steady progress.', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('paused')
    expect(handoffs[0].memberId).toBe('the-mediator')
    expect(handoffs[0].reason).toContain('Want me to bring in outside help?')
    expect(state.queue).toHaveLength(0)
  })

  it('auto-continues an explicit lane handoff', async () => {
    const { state, ids } = fresh()
    const { ctx, routes } = mockEngine(ids)
    const r = await afterTurn(state, 'the-architect', 'Done here — talk to the-builder for the code.', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('continue')
    expect(state.queue).toHaveLength(1)
    expect(state.queue[0].id).toBe('the-builder')
    expect(routes[0]).toMatchObject({ from: 'the-architect', to: 'the-builder', confidence: 95 })
  })

  it('asks inline on a mediator fallback routing', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx, handoffs, notifies } = mockEngine(ids, ['{"members":[{"id":"the-builder","task":"keep going","order":0}]}'])
    const r = await afterTurn(state, 'the-builder', 'Steady progress, needs a judgment call.', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('paused')
    expect(state.paused).toBe(true)
    expect(state.pendingRoute?.id).toBe('the-builder')
    expect(handoffs[0].memberId).toBe('the-builder')
    expect(handoffs[0].reason).toContain('heuristic routing score 60%')
    expect(notifies[0]).toContain('Heuristic routing score 60%')
  })

  it('stops when the mediator has no plan', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    const { ctx } = mockEngine(ids, ['just some prose, no JSON'])
    const r = await afterTurn(state, 'the-builder', 'Steady progress.', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('done')
    expect(state.queue).toHaveLength(0)
  })

  it('stops on empty turns before any routing', async () => {
    const { state, ids } = fresh()
    const { ctx } = mockEngine(ids)
    expect(await afterTurn(state, 'the-builder', '...', RUN.wId, RUN.correlationId, RUN.session, ctx)).toBe('done')
    expect(ctx.streamTurn).not.toHaveBeenCalled()
  })

  it('enforces hop, repeat and blocking guards', async () => {
    const { ids } = fresh()
    const capped = createEngineState(30)
    capped.hops = 8
    capped.history = ['the-builder']
    const m1 = mockEngine(ids)
    expect(await afterTurn(capped, 'the-builder', 'more work', RUN.wId, RUN.correlationId, RUN.session, m1.ctx)).toBe('done')
    expect(m1.ctx.streamTurn).not.toHaveBeenCalled()

    const m3 = mockEngine(['the-builder'])
    const s3 = createEngineState(30)
    await afterTurn(s3, 'the-builder', 'w1', RUN.wId, RUN.correlationId, RUN.session, m3.ctx)
    await afterTurn(s3, 'the-builder', 'w2', RUN.wId, RUN.correlationId, RUN.session, m3.ctx)
    expect(await afterTurn(s3, 'the-builder', 'w3', RUN.wId, RUN.correlationId, RUN.session, m3.ctx)).toBe('done')
    // two mediator calls for the first turns, zero for the guarded third
    expect(m3.ctx.streamTurn).toHaveBeenCalledTimes(2)

    const blocked = createEngineState(30)
    const m4 = mockEngine(ids)
    expect(await afterTurn(blocked, 'the-builder', 'This is blocking on credentials.', RUN.wId, RUN.correlationId, RUN.session, m4.ctx)).toBe(
      'done',
    )
  })

  it('pauses for @user and arms a single nudge', async () => {
    const { state, ids } = fresh()
    const { ctx, handoffs, nudges } = mockEngine(ids)
    const r = await afterTurn(state, 'the-builder', 'Stuck on the API key — @user which provider?', RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('paused')
    expect(state.awaiting).toEqual({ memberId: 'the-builder' })
    expect(handoffs[0].reason).toContain('which provider?')
    expect(nudges).toHaveLength(1)
    expect(nudges[0].ms).toBe(90_000)
    nudges[0].fire()
    expect(ctx.onNudge).toHaveBeenCalledWith({ memberId: 'the-builder', wId: 'ws-1', correlationId: 'c-1', session: 1 })
    // firing again after the wait cleared is a no-op
    nudges[0].fire()
    expect(ctx.onNudge).toHaveBeenCalledTimes(1)
  })

  it('never re-arms HITL on nudge turns', async () => {
    const { state, ids } = fresh()
    const { ctx } = mockEngine(ids)
    const r = await afterTurn(state, 'the-builder', 'Still need @user input here.', RUN.wId, RUN.correlationId, RUN.session, ctx, {
      nudge: true,
    })
    expect(r).toBe('done')
    expect(state.awaiting).toBeNull()
  })

  it('does not pause on @user inside code or on an email address', async () => {
    const outputs = [
      'Added the route.\n```py\n@user.route("/x")\ndef f(): pass\n```\nAll wired.',
      'Reach the maintainer at contact@user.com when ready.',
    ]
    for (const raw of outputs) {
      const { state, ids } = fresh()
      const { ctx, handoffs, nudges } = mockEngine(ids)
      const r = await afterTurn(state, 'the-builder', raw, RUN.wId, RUN.correlationId, RUN.session, ctx)
      expect(r).toBe('done')
      expect(state.awaiting).toBeNull()
      expect(handoffs).toHaveLength(0)
      expect(nudges).toHaveLength(0)
    }
  })

  it('takes the handoff reason from the real @user line, not a code line', async () => {
    const { state, ids } = fresh()
    const { ctx, handoffs } = mockEngine(ids)
    const raw = 'Scaffolded it.\n```py\n@user.route("/x")\n```\n@user which region should this deploy to?'
    const r = await afterTurn(state, 'the-builder', raw, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(r).toBe('paused')
    expect(handoffs[0].reason).toBe('which region should this deploy to?')
  })
})

describe('hasUserMention', () => {
  it('hears every legitimate way to address the user', () => {
    expect(hasUserMention('@user which region?')).toBe(true)
    expect(hasUserMention('@user, which region?')).toBe(true)
    expect(hasUserMention('Blocked. Hi @user. Which region?')).toBe(true)
    expect(hasUserMention('Need `@user` to pick a region')).toBe(true)
    expect(hasUserMention('Done.\n@user pick one')).toBe(true)
    expect(hasUserMention('Still @USER input here')).toBe(true)
  })

  it('ignores fenced code, unclosed fences, emails and member access', () => {
    expect(hasUserMention('```py\n@user.route("/x")\n```')).toBe(false)
    expect(hasUserMention('```js\n// ask @user later\n```')).toBe(false)
    expect(hasUserMention('Starting.\n```py\n@user')).toBe(false)
    expect(hasUserMention('mail contact@user.com please')).toBe(false)
    expect(hasUserMention('see @user.profile for details')).toBe(false)
    expect(hasUserMention('uses @user_id and @username')).toBe(false)
  })

  it('keeps a real mention that follows a code block', () => {
    expect(hasUserMention('```py\nx = 1\n```\n@user which region?')).toBe(true)
  })
})

describe('engineTakeTurn', () => {
  it('tracks bookkeeping and applies the thread policy', async () => {
    const { state, ids } = fresh()
    const { ctx } = mockEngine(ids, ['hello world'])
    const raw = await engineTakeTurn(state, 'the-builder', 'do it', RUN.wId, RUN.correlationId, ctx)
    expect(raw).toBe('hello world')
    expect(state.lastTurn).toEqual({ memberId: 'the-builder', task: 'do it', raw: 'hello world' })
    expect(state.lastTask).toBe('do it')
    expect(state.turnCounter).toBe(1)
    expect(state.thread).toHaveLength(1)

    const skipState = createEngineState(30)
    const m2 = mockEngine(ids, ['plan json'])
    await engineTakeTurn(skipState, 'the-mediator', 'route', RUN.wId, RUN.correlationId, m2.ctx, { threadMode: 'skip' })
    expect(skipState.thread).toHaveLength(0)

    const emptyState = createEngineState(30)
    const m3 = mockEngine(ids, ['...'])
    await engineTakeTurn(emptyState, 'the-builder', 'do it', RUN.wId, RUN.correlationId, m3.ctx)
    expect(emptyState.thread).toHaveLength(0)
  })
})

describe('pump', () => {
  it('drains the queue within budget and stops on done', async () => {
    const ids = ['the-architect', 'the-builder']
    const state = createEngineState(30)
    state.queue = [{ id: 'the-architect', task: 'plan' }]
    const { ctx } = mockEngine(ids, ['Talk to the-builder for code.', 'all done', 'no plan here'])
    await pump(state, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(state.queue).toHaveLength(0)
    expect(state.budget).toBe(28)
    expect(state.hops).toBe(2)
  })

  it('retries a thinking-only answer once with the direct prompt', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    state.queue = [{ id: 'the-builder', task: 'work' }]
    const { ctx, turns } = mockEngine(ids, ['...', 'real work now', 'no plan'])
    await pump(state, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(turns[1].task).toContain('Deliver the final answer now')
    expect(state.retriedTurn).not.toBeNull()
  })

  it('breaks on abort without consuming the turn', async () => {
    const ids = ['the-builder']
    const state = createEngineState(30)
    state.queue = [{ id: 'the-builder', task: 'work' }]
    const { ctx } = mockEngine(ids)
    ctx.isAborted = () => true
    await pump(state, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(ctx.streamTurn).not.toHaveBeenCalled()
    expect(state.budget).toBe(30)
  })
})

describe('settle', () => {
  it('skips synthesis while paused for a human', async () => {
    const { state, ids } = fresh()
    state.paused = true
    const { ctx } = mockEngine(ids)
    await settle(state, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(ctx.runSynthesis).not.toHaveBeenCalled()
    expect(ctx.setDone).not.toHaveBeenCalled()
  })

  it('synthesizes then marks done with a notification', async () => {
    const { state, ids } = fresh()
    const { ctx, notifies } = mockEngine(ids)
    await settle(state, RUN.wId, RUN.correlationId, RUN.session, ctx)
    expect(ctx.runSynthesis).toHaveBeenCalledWith('ws-1', 'c-1')
    expect(ctx.setDone).toHaveBeenCalled()
    expect(notifies).toContain('Workspace run finished.')
  })
})

describe('clearPause and resetEngineState', () => {
  it('clears pause points and optionally keeps the pending proposal', () => {
    const { state, ids } = fresh()
    state.pendingRoute = { id: 'the-builder', task: 't', confidence: 60 }
    state.awaiting = { memberId: 'the-builder' }
    state.paused = true
    const { ctx } = mockEngine(ids)
    clearPause(state, ctx, { keepPending: true })
    expect(state.pendingRoute).not.toBeNull()
    expect(state.awaiting).toBeNull()
    expect(state.paused).toBe(false)
    expect(ctx.clearNudge).toHaveBeenCalled()
    clearPause(state, ctx)
    expect(state.pendingRoute).toBeNull()
  })

  it('resets the full engine state to a fresh budget', () => {
    const { state } = fresh()
    state.queue = [{ id: 'x', task: 'y' }]
    state.history = ['the-builder']
    state.hops = 5
    state.thread = [{ role: 'user', content: 'hi' }]
    state.turnCounter = 9
    resetEngineState(state, 30)
    expect(state).toEqual(createEngineState(30))
  })
})
