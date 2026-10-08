import { runWorkspaceCommand, type CommandCtx } from './workspace-command-run'
import { parseWorkspaceCommand, isEmptyPing } from './workspace-commands'
import { parseMentions } from './workspace-mentions'
import { parseMediatorPlan, fallbackPlan } from './workspace-orchestrator'
import { parseHandoffMention } from './workspace-router'
import { appendThreadWithReactionCap, reactionThreadLines, suggestReactions } from './workspace-reactions'
import { isEmptyTurn } from './workspace-polish'
import {
  engineTakeTurn,
  afterTurn,
  pump,
  settle,
  enterAwaiting,
  findUserQuestion,
  hasUserMention,
  type EngineState,
  type EngineCtx,
} from './workspace-engine'
import type { WorkspaceSpec } from '../_types/workspace'

// Run drivers: start / intervention / resume. Pure orchestration over an
// injected context — the hook only sets up UI state and session tokens.

// Per-turn record: mirror the autonomous reaction into the shared thread
// (so every later turn sees messages AND reactions) and onto the chat bubble.
// Mediator planning turns and empty/thinking-only turns stay quiet.
function recordTurn(state: EngineState, ctx: EngineCtx, memberId: string, wId: string, raw: string): void {
  if (memberId === 'the-mediator' || isEmptyTurn(raw)) return
  const memberIds = ctx.getSpec()?.memberIds ?? []
  if (memberIds.length === 0) return
  state.thread = appendThreadWithReactionCap(state.thread, reactionThreadLines(raw, memberId, memberIds))
  ctx.pushReaction?.(
    `${wId}-${memberId}-${state.turnCounter}`,
    suggestReactions({ content: raw, authorId: memberId, memberIds }),
  )
}

function recordUser(state: EngineState, spec: WorkspaceSpec, content: string): void {
  state.thread = appendThreadWithReactionCap(state.thread, [
    { role: 'user', content },
    ...reactionThreadLines(content, 'user', spec.memberIds),
  ])
}

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
  const recorded = (memberId: string, raw: string) => recordTurn(state, ctx, memberId, wId, raw)
  state.queue.push({ id: p.id, task: p.task })
  await pump(state, wId, correlationId, session, ctx, recorded)
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
    const recorded = (id: string, raw: string) => recordTurn(state, ctx, id, wId, raw)
    const nudge = await engineTakeTurn(state, memberId, prompt, wId, correlationId, ctx, {
      onRecorded: (raw) => recorded(memberId, raw),
    })
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
    takeTurn: (m, t, w, c, o) =>
      engineTakeTurn(state, m, t, w, c, ctx, {
        ...o,
        onRecorded: (raw) => {
          o?.onRecorded?.(raw)
          recordTurn(state, ctx, m, w, raw)
        },
      }),
    pump: (w, c, s) => pump(state, w, c, s, ctx, (m, raw) => recordTurn(state, ctx, m, w, raw)),
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
      const spec = ctx.getSpec()
      if (!spec) {
        state.thread = [...state.thread, { role: 'user', content }]
        return
      }
      recordUser(state, spec, content)
    },
    isCurrentSession: (s) => ctx.isCurrentSession(s),
  }
}

// A mediator turn that addresses the user blocks the group like any member
// turn does — even when it also contains a JSON plan. The human was asked,
// so the human owns the next step; the queued team stays frozen.
function pauseIfMediatorAsked(
  state: EngineState,
  spec: WorkspaceSpec,
  mediatorOutput: string,
  run: { wId: string; correlationId: string; session: number },
  ctx: EngineCtx,
): boolean {
  if (!hasUserMention(mediatorOutput) && !findUserQuestion(mediatorOutput, spec.memberIds)) return false
  enterAwaiting(state, 'the-mediator', mediatorOutput, run.wId, run.correlationId, run.session, ctx)
  return true
}

// Mediator is the room facilitator: it understands the user goal, says in
// one or two short lines who should act next (naming ONLY workspace members),
// and attaches a machine-readable plan. Prose stays visible in chat (group
// chat), JSON is stripped from view but drives the queue.
function mediatorPrompt(spec: WorkspaceSpec, userText: string): string {
  return `User goal: ${userText}\n\nYou may ONLY delegate to these workspace members: ${spec.memberIds.join(", ")}. Never name anyone else.\nReply with 1-2 short lines saying who acts next and why (use "talk to the-<name>" for the handoff), then append EXACTLY this JSON with a single member:\n{"members":[{"id":"<one of: ${spec.memberIds.join(", ")}>","task":"<one-sentence handoff task>","order":0}]}`;
}

// Conversational delegation: "talk to the-X" names a workspace member even
// without JSON — honor it before falling back to the whole team.
function queueFromMediatorOutput(
  state: EngineState,
  spec: WorkspaceSpec,
  mediatorOutput: string,
  fallbackTask: string,
  ctx: EngineCtx,
  from: string,
): void {
  const mentioned = parseHandoffMention(mediatorOutput, spec.memberIds)
  if (mentioned) {
    ctx.pushRoute({ from, to: mentioned, confidence: 95, reason: 'mediator delegation' })
    state.queue = [{ id: mentioned, task: fallbackTask }]
    return
  }
  const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
  const effective = plan ?? fallbackPlan(spec)
  state.queue = effective.members.map((m) => ({ id: m.id, task: m.task }))
}
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
      const mediatorOutput = await engineTakeTurn(state, 'the-mediator', mediatorPrompt(spec, spec.instruction), wId, correlationId, ctx, {
        threadMode: 'raw',
      })
      if (!ctx.isCurrentSession(session)) return
      if (pauseIfMediatorAsked(state, spec, mediatorOutput, { wId, correlationId, session }, ctx)) return
      queueFromMediatorOutput(state, spec, mediatorOutput, spec.instruction, ctx, 'the-mediator')
    }
    const recorded = (memberId: string, raw: string) => recordTurn(state, ctx, memberId, wId, raw)
    await pump(state, wId, correlationId, session, ctx, recorded)
    // Group chat: no synthesizer — member turns are the answer.
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
      recordUser(state, spec, content)
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
    // Group-chat ownership: a pending @user question blocks the whole room.
    // The reply goes back to the member who asked first — nobody else runs
    // until that member answers without re-asking (then the frozen queue resumes).
    if (state.awaiting) {
      const owner = state.awaiting.memberId
      recordUser(state, spec, content)
      ctx.pushUserBubble(content)
      state.awaiting = null
      state.paused = false
      ctx.clearHandoff()
      ctx.setRunning()
      const recorded = (memberId: string, raw: string) => recordTurn(state, ctx, memberId, workspaceId, raw)
      const raw = await engineTakeTurn(
        state,
        owner,
        `User replied: ${content}\nDecide: if you still need something, ask ONE short @user question and stop. Otherwise continue in your lane.`,
        workspaceId,
        correlationId,
        ctx,
        { onRecorded: (out) => recorded(owner, out) },
      )
      if (!ctx.isCurrentSession(session)) return
      const r = await afterTurn(state, owner, raw, workspaceId, correlationId, session, ctx)
      if (r === 'continue') await pump(state, workspaceId, correlationId, session, ctx, recorded)
      if (ctx.isCurrentSession(session)) await settle(state, workspaceId, correlationId, session, ctx)
      return
    }
    // @-mentions skip the mediator entirely.
    const direct = parseMentions(content, spec.memberIds)
    if (direct.error) {
      ctx.fail(direct.error)
      return
    }
    recordUser(state, spec, content)
    ctx.pushUserBubble(content)
    if (direct.targets.length > 0) {
      for (const id of direct.targets) {
        if (state.budget <= 0) break
        ctx.pushRoute({ from: 'user', to: id, confidence: 100, reason: 'direct mention' })
        state.queue.push({ id, task: direct.cleanText || content })
      }
    } else {
      const mediatorOutput = await engineTakeTurn(state, 'the-mediator', mediatorPrompt(spec, content), workspaceId, correlationId, ctx, {
        threadMode: 'raw',
      })
      if (!ctx.isCurrentSession(session)) return
      if (pauseIfMediatorAsked(state, spec, mediatorOutput, { wId: workspaceId, correlationId, session }, ctx)) {
        return
      }
      queueFromMediatorOutput(state, spec, mediatorOutput, content, ctx, 'the-mediator')
    }
    const recorded = (memberId: string, raw: string) => recordTurn(state, ctx, memberId, workspaceId, raw)
    await pump(state, workspaceId, correlationId, session, ctx, recorded)
    if (ctx.isCurrentSession(session)) {
      await settle(state, workspaceId, correlationId, session, ctx)
    }
  } catch (err) {
    if (!ctx.isCurrentSession(session)) return
    if ((err as Error).name === 'AbortError') return
    ctx.fail(err instanceof Error ? err.message : String(err))
  }
}
