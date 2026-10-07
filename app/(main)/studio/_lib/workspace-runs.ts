import { runWorkspaceCommand, type CommandCtx } from './workspace-command-run'
import { parseWorkspaceCommand, isEmptyPing } from './workspace-commands'
import { parseMentions } from './workspace-mentions'
import { parseMediatorPlan, fallbackPlan } from './workspace-orchestrator'
import {
  engineTakeTurn,
  afterTurn,
  pump,
  settle,
  enterAwaiting,
  findUserQuestion,
  type EngineState,
  type EngineCtx,
} from './workspace-engine'
import type { WorkspaceSpec } from '../_types/workspace'

// Run drivers: start / intervention / resume. Pure orchestration over an
// injected context — the hook only sets up UI state and session tokens.

// Ask-inline resume: consumes the paused proposal and re-enters the loop.
export async function resumePending(
  state: EngineState,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<void> {
  const p = state.pendingRoute
  state.pendingRoute = null
  state.paused = false
  if (!p) return
  ctx.setRunning()
  state.queue.push({ id: p.id, task: p.task })
  await pump(state, wId, correlationId, session, ctx)
  if (ctx.isCurrentSession(session)) await settle(state, wId, correlationId, session, ctx)
}

// Post-silence resume shared by the Continue button and the nudge timer.
// Best-effort: the thread already holds the question.
export async function resumeAfterNudge(
  state: EngineState,
  memberId: string,
  prompt: string,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<void> {
  try {
    const nudge = await engineTakeTurn(state, memberId, prompt, wId, correlationId, ctx)
    if (!ctx.isCurrentSession(session)) return
    const r = await afterTurn(state, memberId, nudge, wId, correlationId, session, ctx, { nudge: true })
    if (r === 'continue') await pump(state, wId, correlationId, session, ctx)
    if (ctx.isCurrentSession(session)) await settle(state, wId, correlationId, session, ctx)
  } catch {
    // best-effort resume
  }
}

function toCommandCtx(state: EngineState, ctx: EngineCtx): CommandCtx {
  return {
    takeTurn: (m, t, w, c, o) => engineTakeTurn(state, m, t, w, c, ctx, o),
    pump: (w, c, s) => pump(state, w, c, s, ctx),
    settle: (w, c, s) => settle(state, w, c, s, ctx),
    afterTurn: (m, r, w, c, s) => afterTurn(state, m, r, w, c, s, ctx),
    runSynthesis: (w, c) => ctx.runSynthesis(w, c),
    pushCommand: (content) => ctx.pushNote(content),
    stop: () => ctx.requestStop(),
    reset: () => ctx.requestReset(),
    setRunning: () => ctx.setRunning(),
    getSpec: () => ctx.getSpec(),
    getLastTurn: () => state.lastTurn,
    takePending: () => {
      const p = state.pendingRoute
      state.pendingRoute = null
      state.paused = false
      return p
    },
    enqueue: (turn) => {
      state.queue.push(turn)
    },
    appendThreadUser: (content) => {
      state.thread = [...state.thread, { role: 'user', content }]
    },
    isCurrentSession: (s) => ctx.isCurrentSession(s),
  }
}

// Unplannable mediator output that asks the user pauses instead of running
// the fallback team — the human was addressed, so the human owns the next step.
function pauseIfMediatorAsked(
  state: EngineState,
  spec: WorkspaceSpec,
  mediatorOutput: string,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): boolean {
  if (parseMediatorPlan(mediatorOutput, spec.memberIds)) return false
  if (!findUserQuestion(mediatorOutput, spec.memberIds)) return false
  enterAwaiting(state, 'the-mediator', mediatorOutput, wId, correlationId, session, ctx)
  return true
}

// Fresh run: guards, queue planning, pump, settle. The hook owns UI setup
// (bubbles, session token, state init) and abort cleanup; errors map to UI
// here so drivers stay hook-free.
export async function startRun(
  state: EngineState,
  spec: WorkspaceSpec,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<void> {
  // An empty ping would burn a full round-trip and read as "mid-thought"
  // to members — answer inline, session stays usable for follow-ups.
  if (isEmptyPing(spec.instruction)) {
    ctx.pushNote('That looks empty — tell me the goal in a few words, or mention a member with `@`.')
    ctx.setDone()
    return
  }
  // Commands run in follow-ups — an initial "/" is a hint, not a goal.
  if (parseWorkspaceCommand(spec.instruction)) {
    ctx.pushNote('Start with an instruction first — `/summarize`, `/retry` and friends run as follow-ups.')
    ctx.setDone()
    return
  }

  // @-mentions skip the mediator entirely — the user already delegated.
  const direct = parseMentions(spec.instruction, spec.memberIds)
  if (direct.error) {
    ctx.fail(direct.error)
    return
  }

  try {
    if (direct.targets.length > 0) {
      for (const id of direct.targets) {
        if (state.budget <= 0) break
        if (ctx.isAborted()) break
        ctx.pushRoute({ from: 'user', to: id, confidence: 100, reason: 'direct mention' })
        state.queue.push({ id, task: direct.cleanText || 'continue with your lane' })
      }
    } else {
      const mediatorOutput = await engineTakeTurn(state, 'the-mediator', spec.instruction, wId, correlationId, ctx, {
        threadMode: 'raw',
      })
      if (!ctx.isCurrentSession(session)) return
      const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
      if (!plan && pauseIfMediatorAsked(state, spec, mediatorOutput, wId, correlationId, session, ctx)) return
      const effective = plan ?? fallbackPlan(spec)
      state.queue = effective.members.map((m) => ({ id: m.id, task: m.task }))
    }
    await pump(state, wId, correlationId, session, ctx)
    // Auto-synthesizer on every workspace run — final polished natural answer
    // like Claude Work, using shared thread (the reliable session object).
    if (ctx.isCurrentSession(session)) {
      await settle(state, wId, correlationId, session, ctx)
    }
  } catch (err) {
    if (!ctx.isCurrentSession(session)) return
    if ((err as Error).name === 'AbortError') {
      ctx.pauseOnAbort()
      return
    }
    ctx.fail(err instanceof Error ? err.message : String(err))
  }
}

// Follow-up intervention: guards, local commands, mentions, re-plan, pump, settle.
export async function intervene(
  state: EngineState,
  content: string,
  workspaceId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<void> {
  const spec = ctx.getSpec()
  if (!spec) return
  try {
    if (isEmptyPing(content)) {
      state.thread = [...state.thread, { role: 'user', content }]
      ctx.pushUserBubble(content)
      ctx.pushNote('That looks empty — tell me the goal in a few words, or mention a member with `@`.')
      if (ctx.isCurrentSession(session)) ctx.setDone()
      return
    }
    // Local commands never touch the LLM (except the ones that must).
    // The bubble always shows; the shared thread only takes real content —
    // a bare `/summarize` must not become a synthesis source turn.
    const cmd = parseWorkspaceCommand(content)
    if (cmd) {
      ctx.pushUserBubble(content)
      if (cmd.name === 'continue' && cmd.args) {
        state.thread = [...state.thread, { role: 'user', content }]
      }
      const handled = await runWorkspaceCommand(
        cmd,
        { wId: workspaceId, correlationId, session },
        toCommandCtx(state, ctx),
      )
      if (handled === 'handled') {
        if (ctx.isCurrentSession(session) && !state.paused) ctx.setDone()
        return
      }
    }
    // @-mentions skip the mediator entirely.
    const direct = parseMentions(content, spec.memberIds)
    if (direct.error) {
      ctx.fail(direct.error)
      return
    }
    state.thread = [...state.thread, { role: 'user', content }]
    ctx.pushUserBubble(content)
    if (direct.targets.length > 0) {
      for (const id of direct.targets) {
        if (state.budget <= 0) break
        ctx.pushRoute({ from: 'user', to: id, confidence: 100, reason: 'direct mention' })
        state.queue.push({ id, task: direct.cleanText || content })
      }
    } else {
      const mediatorOutput = await engineTakeTurn(state, 'the-mediator', content, workspaceId, correlationId, ctx, {
        threadMode: 'raw',
      })
      if (!ctx.isCurrentSession(session)) return
      const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
      if (plan) {
        state.queue = plan.members.map((m) => ({ id: m.id, task: m.task }))
      } else if (pauseIfMediatorAsked(state, spec, mediatorOutput, workspaceId, correlationId, session, ctx)) {
        return
      } else {
        state.queue = fallbackPlan(spec).members.map((m) => ({ id: m.id, task: content }))
      }
    }
    await pump(state, workspaceId, correlationId, session, ctx)
    if (ctx.isCurrentSession(session)) {
      await settle(state, workspaceId, correlationId, session, ctx)
    }
  } catch (err) {
    if (!ctx.isCurrentSession(session)) return
    if ((err as Error).name === 'AbortError') return
    ctx.fail(err instanceof Error ? err.message : String(err))
  }
}
