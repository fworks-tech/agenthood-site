import { parseMediatorPlan, type ThreadMessage } from './workspace-orchestrator'
import { scoreNext, applyThreshold, shouldContinue, type ScoredNext } from './workspace-router'
import { toPolished, isEmptyTurn } from './workspace-polish'
import type { ThreadMode } from './workspace-command-run'
import type { WorkspaceSpec } from '../_types/workspace'

export const NUDGE_MS = 90_000
const ROUTE_TASK_CHARS = 2000

export type EngineTurn = { id: string; task: string }
export type EnginePendingRoute = EngineTurn & { confidence: number }

export type EngineState = {
  queue: EngineTurn[]
  history: string[]
  hops: number
  lastTurn: { memberId: string; task: string; raw: string } | null
  lastTask: string
  retriedTurn: number | null
  pendingRoute: EnginePendingRoute | null
  awaiting: { memberId: string } | null
  paused: boolean
  budget: number
  turnCounter: number
  thread: ThreadMessage[]
}

export function createEngineState(budget: number): EngineState {
  return {
    queue: [],
    history: [],
    hops: 0,
    lastTurn: null,
    lastTask: '',
    retriedTurn: null,
    pendingRoute: null,
    awaiting: null,
    paused: false,
    budget,
    turnCounter: 0,
    thread: [],
  }
}

export type NudgePayload = { memberId: string; wId: string; correlationId: string; session: number }

export type EngineCtx = {
  /** Transport only: runs one member turn, streams UI, returns raw content. No thread writes. */
  streamTurn: (
    memberId: string,
    task: string,
    turnIndex: number,
    wId: string,
    correlationId: string,
    thread: ThreadMessage[],
  ) => Promise<string>
  runSynthesis: (wId: string, correlationId: string) => Promise<string | null>
  pushRoute: (route: { from: string; to: string; confidence: number; reason: string }) => void
  /** Dashed command/note bubble — a view, never thread content. */
  pushNote: (content: string) => void
  /** User bubble — always shows, even for empty pings and local commands. */
  pushUserBubble: (content: string) => void
  showHandoff: (memberId: string, reason: string) => void
  clearHandoff: () => void
  setRunning: () => void
  setDone: () => void
  fail: (message: string) => void
  /** Start aborted mid-flight — the stop owns the next step. */
  pauseOnAbort: () => void
  requestStop: () => void
  requestReset: () => void
  notify: (body: string) => void
  displayName: (memberId: string) => string
  getSpec: () => WorkspaceSpec | null
  scheduleNudge: (ms: number, fire: () => void) => void
  clearNudge: () => void
  isAborted: () => boolean
  isCurrentSession: (s: number) => boolean
  onNudge: (payload: NudgePayload) => void
}

// An explicit `@user` address. Fenced code is dropped first (a closed fence,
// then an unclosed trailing one from a truncated stream), and the mention must
// not be glued to a word, dot or dash (emails like `a@user.com`) nor followed
// by `.word` (member access like `@user.route`). Written without lookbehind
// so older Safari can still parse the bundle. `@user.` ending a sentence and
// an inline-backticked `@user` still count.
const USER_MENTION_RE = /(^|[^\w.-])@user\b(?!\.\w)/i

function stripFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '\n').replace(/```[\s\S]*$/, '')
}

export function hasUserMention(output: string): boolean {
  return USER_MENTION_RE.test(stripFences(output))
}

// A member's closing question to the user pauses the chain like @user does.
// Heuristic, not exact: only the last question in the closing tail counts, it
// must address the user (not muse aloud), and member-directed questions keep
// routing — by canonical id anywhere, or by display name in vocative position
// ("take this, Builder?", "Builder, can you confirm?", "Hey Builder: ...",
// "@builder", "talk to the builder"). A bare lane word in passing
// ("The Strategist will dig in") is not an address. Fenced and inline code is
// ignored so ternaries and your_* names never read as questions.
const TAIL_CHARS = 600
// A user mention that is not glued to a word, dot or dash — excludes emails and `user.route`.
// `@user.` ending a sentence and an inline‑backticked `@user` still count.
const USER_MENTION_RE = /(^|[^\w.-])@user\b(?!\.\w|-\w)/i
function stripFences(text: string) {
  return text.replace(/```[\s\S]*?```/g, '\n').replace(/```[\s\S]*$/, '')
}
const MIN_QUESTION_CHARS = 4
const MAX_QUESTION_CHARS = 300
const ASK_RE = /\b(want me to|would you|do you|are you|have you|shall i|should i|can i|let me know|your call|up to you|you decide|you|your|yours)\b/i
const IDIOM_RE = /\b(you know|thank you|bless you)\b/i
const QUESTION_RE = new RegExp(`[^?!\\n]{${MIN_QUESTION_CHARS},${MAX_QUESTION_CHARS}}\\?`, 'g')

function mentionsMember(lower: string, validIds: string[]): boolean {
  if (validIds.some((id) => lower.includes(id))) return true
  return validIds
    .map((id) => id.replace(/^the-/, ''))
    .some((short) => {
      // `q` can span earlier sentences, so a leading vocative sits after a
      // sentence boundary, not only at the string start.
      const marked = `(?:@|talk to\\s+(?:the\\s+)?|,\\s*(?:the\\s+)?)${short}\\b`
      const leading = `(?:^|[.;:]\\s+)(?:(?:hey|hi|ok|okay|so|and)\\s+)?(?:the\\s+)?${short}\\s*[,:—–-]`
      return new RegExp(`${marked}|${leading}`).test(lower)
    })
}

export function findUserQuestion(output: string, validIds: string[] = []): string | null {
  const prose = stripFences(output).replace(/`[^`\n]+`/g, '``')
  const tail = prose.slice(-TAIL_CHARS)
  const questions = tail.match(QUESTION_RE) ?? []
  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i].trim()
    if (!ASK_RE.test(q) || IDIOM_RE.test(q)) continue
    if (mentionsMember(q.toLowerCase(), validIds)) continue
    return q.slice(0, MAX_QUESTION_CHARS)
  }
  return null
}

export function hasUserMention(output: string) {
  return USER_MENTION_RE.test(stripFences(output))
}

// Single turn with bookkeeping for retry + chained continuation. Owns the
// thread-write policy: mediator plans are raw, routing fallbacks skip, and
// thinking-only or empty turns never enter the shared thread.
export async function engineTakeTurn(
  state: EngineState,
  memberId: string,
  task: string,
  wId: string,
  correlationId: string,
  ctx: EngineCtx,
  opts?: { threadMode?: ThreadMode },
): Promise<string> {
  state.lastTask = task
  const raw = await ctx.streamTurn(memberId, task, ++state.turnCounter, wId, correlationId, [...state.thread])
  state.lastTurn = { memberId, task, raw }
  const mode = opts?.threadMode ?? 'filtered'
  if (mode === 'raw') {
    state.thread = [...state.thread, { role: 'assistant', content: raw }]
  } else if (mode === 'filtered' && !isEmptyTurn(raw)) {
    state.thread = [...state.thread, { role: 'assistant', content: toPolished(raw) }]
  }
  return raw
}

// Mediator fallback for ambiguous hops — constrained to one member at
// ask-level confidence, so a guess never auto-runs unreviewed.
export async function mediatorNext(
  state: EngineState,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<{ next: ScoredNext | null; raw: string }> {
  const ids = ctx.getSpec()?.memberIds ?? []
  const tail = state.thread
    .map((m) => m.content)
    .join('\n')
    .slice(-3000)
  const raw = await ctx.streamTurn(
    'the-mediator',
    `Route this workspace turn. Reply with ONLY this JSON, no prose: {"members":[{"id":"<one of: ${ids.join(', ')}>","task":"<one-sentence handoff task>","order":0}]}\n\nThread tail:\n${tail}`,
    ++state.turnCounter,
    wId,
    correlationId,
    [...state.thread],
  )
  if (!ctx.isCurrentSession(session)) return { next: null, raw }
  const plan = parseMediatorPlan(raw, ids)
  const first = plan?.members[0]
  if (!first) return { next: null, raw }
  return { next: { nextId: first.id, confidence: 60, reason: first.task || 'mediator routing' }, raw }
}

export function enterAwaiting(
  state: EngineState,
  memberId: string,
  raw: string,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): void {
  const atLine = stripFences(raw)
    .split('\n')
    .find((l) => USER_MENTION_RE.test(l))
  const asked = atLine?.replace(USER_MENTION_RE, '$1') ?? findUserQuestion(raw, ctx.getSpec()?.memberIds ?? []) ?? raw
  const question = asked.trim().slice(0, 300) || 'needs your input'
  state.awaiting = { memberId }
  state.paused = true
  ctx.showHandoff(memberId, question)
  ctx.notify(`${ctx.displayName(memberId)} needs your input: ${question.slice(0, 120)}`)
  ctx.clearNudge()
  // The resume runs in the nudge consumer — the timer only raises the signal.
  ctx.scheduleNudge(NUDGE_MS, () => {
    if (!ctx.isCurrentSession(session) || !state.awaiting) return
    state.awaiting = null
    state.paused = false
    ctx.onNudge({ memberId, wId, correlationId, session })
  })
}

export async function afterTurn(
  state: EngineState,
  memberId: string,
  raw: string,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
  opts?: { nudge?: boolean },
): Promise<'continue' | 'paused' | 'done'> {
  state.history.push(memberId)
  // Nothing routable — stop the chain and synthesize from real content.
  if (isEmptyTurn(raw)) return 'done'
  // Guards run on every turn, including planned ones — a long mediator
  // plan never bypasses the hop, repeat, or blocking caps.
  const guard = shouldContinue({ hops: state.hops, history: state.history, lastOutput: raw })
  if (guard.stop) return 'done'
  // HITL: a member addressing @user — or ending in a direct question to the
  // user — pauses the loop for a human reply. Nudge turns are exempt — a
  // re-ask after silence must resolve down the terminal path, or the single
  // nudge repeats forever.
  const ids = ctx.getSpec()?.memberIds ?? []
  if (!opts?.nudge && (hasUserMention(raw) || findUserQuestion(raw, ids))) {
    enterAwaiting(state, memberId, raw, wId, correlationId, session, ctx)
    return 'paused'
  }
  if (state.queue.length > 0) return 'continue'
  let scored = scoreNext(raw, memberId, ids)
  if (!scored) {
    const fb = await mediatorNext(state, wId, correlationId, session, ctx)
    if (!ctx.isCurrentSession(session)) return 'paused'
    if (fb.next) {
      scored = fb.next
    } else if (!opts?.nudge && findUserQuestion(fb.raw, ids)) {
      // A nudge turn must never re-enter awaiting — one reminder is the limit,
      // even when the mediator fallback itself asks the user.
      enterAwaiting(state, 'the-mediator', fb.raw, wId, correlationId, session, ctx)
      return 'paused'
    } else {
      return 'done'
    }
  }
  const task = `Continuing from ${memberId} (${scored.reason}). Stay in your lane:\n${toPolished(raw).slice(0, ROUTE_TASK_CHARS)}`
  const decision = applyThreshold(scored)
  if (decision === 'auto') {
    ctx.pushRoute({ from: memberId, to: scored.nextId, confidence: scored.confidence, reason: scored.reason })
    state.queue.push({ id: scored.nextId, task })
    return 'continue'
  }
  if (decision === 'ask') {
    state.pendingRoute = { id: scored.nextId, task, confidence: scored.confidence }
    state.paused = true
    ctx.pushRoute({ from: memberId, to: scored.nextId, confidence: scored.confidence, reason: scored.reason })
    const name = ctx.displayName(scored.nextId)
    ctx.showHandoff(
      scored.nextId,
      `${name} should continue (heuristic routing score ${scored.confidence}%) — ${scored.reason}. Continue or stop?`,
    )
    ctx.notify(`Continue with ${name}? Heuristic routing score ${scored.confidence}%.`)
    return 'paused'
  }
  return 'done'
}

export async function pump(
  state: EngineState,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<void> {
  while (state.budget > 0 && state.queue.length > 0) {
    if (!ctx.isCurrentSession(session) || ctx.isAborted()) break
    const next = state.queue.shift()
    if (!next) break
    state.budget -= 1
    state.hops += 1
    let raw = await engineTakeTurn(state, next.id, next.task, wId, correlationId, ctx)
    if (!ctx.isCurrentSession(session)) return
    // One auto-retry for a thinking-only answer — then accept and stop.
    if (isEmptyTurn(raw) && state.retriedTurn !== state.turnCounter) {
      state.retriedTurn = state.turnCounter
      raw = await engineTakeTurn(
        state,
        next.id,
        `${next.task}\n\nDeliver the final answer now — no preamble, no thinking-out-loud.`,
        wId,
        correlationId,
        ctx,
      )
      if (!ctx.isCurrentSession(session)) return
    }
    const r = await afterTurn(state, next.id, raw, wId, correlationId, session, ctx)
    if (r !== 'continue') break
  }
}

export async function settle(
  state: EngineState,
  wId: string,
  correlationId: string,
  session: number,
  ctx: EngineCtx,
): Promise<void> {
  // Paused for ask-inline or @user — the human owns the next step.
  if (state.paused) return
  if (ctx.isCurrentSession(session)) {
    await ctx.runSynthesis(wId, correlationId)
  }
  if (ctx.isCurrentSession(session)) {
    ctx.setDone()
    ctx.notify('Workspace run finished.')
  }
}

export function clearPause(
  state: EngineState,
  ctx: Pick<EngineCtx, 'clearNudge' | 'clearHandoff'>,
  opts?: { keepPending?: boolean },
): void {
  ctx.clearNudge()
  if (!opts?.keepPending) state.pendingRoute = null
  state.awaiting = null
  state.paused = false
  ctx.clearHandoff()
}

export function resetEngineState(state: EngineState, budget: number): void {
  state.queue = []
  state.history = []
  state.hops = 0
  state.lastTurn = null
  state.retriedTurn = null
  state.pendingRoute = null
  state.awaiting = null
  state.paused = false
  state.budget = budget
  state.turnCounter = 0
  state.thread = []
}
