'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { readSSEStream } from '../_lib/stream'
import { parseMediatorPlan, fallbackPlan, type ThreadMessage } from '../_lib/workspace-orchestrator'
import { scoreNext, applyThreshold, shouldContinue, type ScoredNext } from '../_lib/workspace-router'
import { parseWorkspaceCommand, isEmptyPing } from '../_lib/workspace-commands'
import { parseMentions } from '../_lib/workspace-mentions'
import { notifyWorkspace, loadNotifyPref, saveNotifyPref, requestNotifyPermission } from '../_lib/workspace-notify'
import { toPolished, isThinkingOnly } from '../_lib/workspace-polish'
import { TURN_BUDGET_DEFAULT, type WorkspaceSpec, type WorkspaceStatus, type WorkspaceMessage } from '../_types/workspace'
import { getAgentById } from '../_data/agents'
import { getActiveWorkspaceId, getWorkspace, saveWorkspace, setActiveWorkspaceId } from '../_lib/workspace-store'

export type WorkspaceToolCall = { id: string; name: string; args: Record<string, unknown>; result?: string; error?: string; status: 'running' | 'complete' | 'error' }
export type { WorkspaceMessage }

export type WorkspaceState = 'idle' | 'running' | 'handoff' | 'done' | 'error'

const NUDGE_MS = 90_000
const ROUTE_TASK_CHARS = 2000

// A turn with nothing routable: empty or thinking-only preamble. These never
// enter the thread (see runTurn) and never extend the chain.
function isEmptyTurn(raw: string): boolean {
  const polished = toPolished(raw)
  return !polished || isThinkingOnly(polished)
}

type QueuedTurn = { id: string; task: string }

export function useWorkspace() {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, WorkspaceStatus>>({})
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('idle')
  const [handoff, setHandoff] = useState<{ memberId: string; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [notifyEnabled, setNotifyEnabledState] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const threadRef = useRef<ThreadMessage[]>([])
  const budgetRef = useRef(TURN_BUDGET_DEFAULT)
  const specRef = useRef<WorkspaceSpec | null>(null)
  // Monotonic turn counter — unique message ids + trace turn index across the whole session.
  const turnCounterRef = useRef(0)
  // Session token: only the latest start/intervention may write terminal state.
  const sessionRef = useRef(0)
  const correlationRef = useRef<string | null>(null)
  // Chain engine: pending queue, per-turn history, last turn, pause points.
  const queueRef = useRef<QueuedTurn[]>([])
  const historyRef = useRef<string[]>([])
  const hopsRef = useRef(0)
  const lastTurnRef = useRef<{ memberId: string; task: string; raw: string } | null>(null)
  const lastTaskRef = useRef('')
  // Turn index of the last auto-retry for a thinking-only answer (one retry max).
  const retriedRef = useRef<number | null>(null)
  const pendingRouteRef = useRef<(QueuedTurn & { confidence: number }) | null>(null)
  const awaitingRef = useRef<{ memberId: string } | null>(null)
  const pausedRef = useRef(false)
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notifyRef = useRef(false)
  const [nudgeSignal, setNudgeSignal] = useState<{ memberId: string; wId: string; correlationId: string; session: number } | null>(null)

  const updateStatus = useCallback((memberId: string, status: WorkspaceStatus) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }))
  }, [])

  const ping = useCallback((body: string) => {
    if (typeof document === 'undefined') return
    notifyWorkspace({ enabled: notifyRef.current, hidden: document.hidden, title: 'Agenthood workspace', body })
  }, [])

  const clearPause = useCallback(() => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
    nudgeTimerRef.current = null
    pendingRouteRef.current = null
    awaitingRef.current = null
    pausedRef.current = false
    setHandoff(null)
  }, [])

  // Hydrate from workspace-store on mount — mirrors useStudioChat persistence.
  // Server Map + client localStorage share the same session so reload preserves chat.
  useEffect(() => {
    const activeId = getActiveWorkspaceId()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifyEnabledState(loadNotifyPref())
    notifyRef.current = loadNotifyPref()
    if (!activeId) return
    const sess = getWorkspace(activeId)
    if (!sess) return
    setMessages(sess.messages)
    setStatusMap(sess.statusMap)
    setWorkspaceId(sess.workspaceId)
    threadRef.current = sess.thread
    specRef.current = sess.spec
    budgetRef.current = sess.budgetLeft
    turnCounterRef.current = sess.turnCounter
    correlationRef.current = sess.correlationId
    setWorkspaceState('done')
  }, [])

  // Persist every change to workspace-store — reliable shared memory for all members + user.
  useEffect(() => {
    if (!workspaceId || !specRef.current) return
    saveWorkspace({
      workspaceId,
      correlationId: correlationRef.current ?? `ws-corr-${workspaceId}`,
      spec: specRef.current,
      thread: threadRef.current,
      messages,
      statusMap,
      memory: {
        goal: specRef.current.instruction,
        scratchpad: {},
        decisions: messages
          .filter((m) => m.memberId !== 'user')
          .map((m) => ({ memberId: m.memberId, turnIndex: m.turnIndex, content: m.content.slice(0, 2000), ts: Date.now() })),
        artifacts: [],
      },
      budgetLeft: budgetRef.current,
      turnCounter: turnCounterRef.current,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setActiveWorkspaceId(workspaceId)
  }, [messages, statusMap, workspaceId])

  const runTurn = useCallback(
    async (memberId: string, instruction: string, turnIndex: number, wId: string, correlationId: string) => {
      const controller = new AbortController()
      abortRef.current = controller
      updateStatus(memberId, 'working')

      const thread = [...threadRef.current]
      const res = await fetch('/api/studio/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
        body: JSON.stringify({
          memberIds: [memberId],
          instruction,
          workspaceId: wId,
          memberId,
          turnIndex,
          thread,
          correlationId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `Workspace turn failed: ${res.status}`)
      }

      let currentContent = ''
      const toolCallsMap = new Map<string, WorkspaceToolCall>()
      const msgId = `${wId}-${memberId}-${turnIndex}`

      setMessages((prev) => [...prev, { id: msgId, memberId, content: '', turnIndex, toolCalls: [] }])

      await readSSEStream(
        res,
        {
          onToken: () => {},
          onDone: () => {},
          onError: (e) => {
            setError(e.message)
            setWorkspaceState('error')
          },
          onLog: () => {},
          onWorkspaceEvent: (event) => {
            if (event.type === 'workspace.token' && typeof event.data === 'string') {
              currentContent += event.data as string
              setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: currentContent } : m)))
            }
            if (event.type === 'workspace.tool_call') {
              const tc: WorkspaceToolCall = {
                id: event.id as string,
                name: event.name as string,
                args: (event.args as Record<string, unknown>) ?? {},
                status: 'running',
              }
              toolCallsMap.set(tc.id, tc)
              setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, toolCalls: Array.from(toolCallsMap.values()) } : m)))
            }
            if (event.type === 'workspace.tool_result') {
              const id = event.id as string
              const existing = toolCallsMap.get(id)
              const status = event.error ? 'error' : 'complete'
              toolCallsMap.set(id, {
                id,
                name: (event.name as string) ?? existing?.name ?? 'tool',
                args: existing?.args ?? (event.args as Record<string, unknown>) ?? {},
                result: (event.result as string) ?? undefined,
                error: (event.error as string) ?? undefined,
                status: status as WorkspaceToolCall['status'],
              })
              setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, toolCalls: Array.from(toolCallsMap.values()) } : m)))
            }
            if (event.type === 'workspace.handoff') {
              setHandoff({ memberId: event.memberId as string, reason: event.reason as string })
              setWorkspaceState('handoff')
            }
            if (event.type === 'workspace.status' && event.status) {
              updateStatus(event.memberId as string, event.status as WorkspaceStatus)
            }
            if (event.type === 'workspace.turn_end') {
              updateStatus(event.memberId as string, 'done')
            }
          },
        },
        controller.signal,
      )

      // Thinking-only or empty turns never enter the shared thread — a bare
      // "..." or preamble would otherwise read as conversation and confuse the
      // next member (or be misattributed to the user). The card still shows it.
      const polishedTurn = toPolished(currentContent)
      if (polishedTurn && !isThinkingOnly(polishedTurn)) {
        threadRef.current = [...threadRef.current, { role: 'assistant', content: polishedTurn }]
      }
      updateStatus(memberId, 'done')
      return currentContent
    },
    [updateStatus],
  )

  // Single turn with bookkeeping for retry + chained continuation.
  const takeTurn = useCallback(
    async (memberId: string, task: string, wId: string, correlationId: string) => {
      lastTaskRef.current = task
      const raw = await runTurn(memberId, task, ++turnCounterRef.current, wId, correlationId)
      lastTurnRef.current = { memberId, task, raw }
      return raw
    },
    [runTurn],
  )

  // Routed pill — a view, never thread content (like synthesis).
  const pushRoute = useCallback((route: { from: string; to: string; confidence: number; reason: string }) => {
    const id = `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages((prev) => [...prev, { id, memberId: 'router', content: '', turnIndex: turnCounterRef.current, route }])
  }, [])

  const pushCommand = useCallback((content: string) => {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages((prev) => [...prev, { id, memberId: 'command', content, turnIndex: turnCounterRef.current }])
  }, [])

  // Mediator fallback for ambiguous hops — constrained to one member at
  // ask-level confidence, so a guess never auto-runs unreviewed.
  const mediatorNext = useCallback(
    async (wId: string, correlationId: string, session: number): Promise<ScoredNext | null> => {
      const ids = specRef.current?.memberIds ?? []
      const tail = threadRef.current
        .map((m) => m.content)
        .join('\n')
        .slice(-3000)
      const raw = await runTurn(
        'the-mediator',
        `Route this workspace turn. Reply with ONLY this JSON, no prose: {"members":[{"id":"<one of: ${ids.join(', ')}>","task":"<one-sentence handoff task>","order":0}]}\n\nThread tail:\n${tail}`,
        ++turnCounterRef.current,
        wId,
        correlationId,
      )
      if (session !== sessionRef.current) return null
      const plan = parseMediatorPlan(raw, ids)
      const first = plan?.members[0]
      if (!first) return null
      return { nextId: first.id, confidence: 60, reason: first.task || 'mediator routing' }
    },
    [runTurn],
  )

  const enterAwaiting = useCallback(
    (memberId: string, raw: string, wId: string, correlationId: string, session: number) => {
      const line = raw.split('\n').find((l) => /@user\b/i.test(l)) ?? raw
      const question = line.replace(/@user\b/i, '').trim().slice(0, 300) || 'needs your input'
      awaitingRef.current = { memberId }
      pausedRef.current = true
      setHandoff({ memberId, reason: question })
      setWorkspaceState('handoff')
      ping(`${getAgentById(memberId)?.name ?? memberId} needs your input: ${question.slice(0, 120)}`)
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
      // The resume runs in the nudge effect below (no engine refs needed):
      // the timer only raises the signal.
      nudgeTimerRef.current = setTimeout(() => {
        if (session !== sessionRef.current || !awaitingRef.current) return
        awaitingRef.current = null
        pausedRef.current = false
        setNudgeSignal({ memberId, wId, correlationId, session })
      }, NUDGE_MS)
    },
    [ping],
  )

  const afterTurn = useCallback(
    async (
      memberId: string,
      raw: string,
      wId: string,
      correlationId: string,
      session: number,
    ): Promise<'continue' | 'paused' | 'done'> => {
      historyRef.current.push(memberId)
      // Nothing routable — stop the chain and synthesize from real content.
      if (isEmptyTurn(raw)) return 'done'
      // HITL: a member addressing @user pauses the loop for a human reply.
      if (/@user\b/i.test(raw)) {
        enterAwaiting(memberId, raw, wId, correlationId, session)
        return 'paused'
      }
      if (queueRef.current.length > 0) return 'continue'
      const guard = shouldContinue({ hops: hopsRef.current, history: historyRef.current, lastOutput: raw })
      if (guard.stop) return 'done'
      let scored = scoreNext(raw, memberId, specRef.current?.memberIds ?? [])
      if (!scored) {
        const fb = await mediatorNext(wId, correlationId, session)
        if (session !== sessionRef.current) return 'paused'
        if (!fb) return 'done'
        scored = fb
      }
      const task = `Continuing from ${memberId} (${scored.reason}). Stay in your lane:\n${toPolished(raw).slice(0, ROUTE_TASK_CHARS)}`
      const decision = applyThreshold(scored)
      if (decision === 'auto') {
        pushRoute({ from: memberId, to: scored.nextId, confidence: scored.confidence, reason: scored.reason })
        queueRef.current.push({ id: scored.nextId, task })
        return 'continue'
      }
      if (decision === 'ask') {
        pendingRouteRef.current = { id: scored.nextId, task, confidence: scored.confidence }
        pausedRef.current = true
        pushRoute({ from: memberId, to: scored.nextId, confidence: scored.confidence, reason: scored.reason })
        const name = getAgentById(scored.nextId)?.name ?? scored.nextId
        setHandoff({
          memberId: scored.nextId,
          reason: `${name} should continue (confidence ${scored.confidence}%) — ${scored.reason}. Continue or stop?`,
        })
        setWorkspaceState('handoff')
        ping(`Continue with ${name}? Confidence ${scored.confidence}%.`)
        return 'paused'
      }
      return 'done'
    },
    [enterAwaiting, mediatorNext, pushRoute, ping],
  )

  const pump = useCallback(
    async (wId: string, correlationId: string, session: number) => {
      while (budgetRef.current > 0 && queueRef.current.length > 0) {
        if (session !== sessionRef.current || abortRef.current?.signal.aborted) break
        const next = queueRef.current.shift()
        if (!next) break
        budgetRef.current -= 1
        hopsRef.current += 1
        let raw = await takeTurn(next.id, next.task, wId, correlationId)
        if (session !== sessionRef.current) return
        // One auto-retry for a thinking-only answer — then accept and stop.
        if (isEmptyTurn(raw) && retriedRef.current !== turnCounterRef.current) {
          retriedRef.current = turnCounterRef.current
          raw = await takeTurn(
            next.id,
            `${next.task}\n\nDeliver the final answer now — no preamble, no thinking-out-loud.`,
            wId,
            correlationId,
          )
          if (session !== sessionRef.current) return
        }
        const r = await afterTurn(next.id, raw, wId, correlationId, session)
        if (r !== 'continue') break
      }
    },
    [takeTurn, afterTurn],
  )

  // Auto-synthesizer: after every agent turn, produce a natural Claude-Work style
  // final answer via LLM provider (opencode-go). Runs on every message sent by
  // an agent, uses shared thread + scratchpad as source, streams as
  // workspace.synthesized into a dedicated synthesizer card.
  const runSynthesis = useCallback(
    async (wId: string, correlationId: string) => {
      // No synthesis if thread empty
      if (threadRef.current.length === 0) return null
      const synId = `syn-${wId}-${Date.now()}`
      let current = ''
      // placeholder card so user sees synthesis in progress
      setMessages((prev) => [...prev, { id: synId, memberId: 'synthesizer', content: '', turnIndex: 999 }])
      try {
        const res = await fetch('/api/studio/workspaces/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
          body: JSON.stringify({ workspaceId: wId, correlationId, thread: threadRef.current }),
        })
        if (!res.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== synId))
          return null
        }
        await readSSEStream(
          res,
          {
            onToken: () => {},
            onDone: () => {},
            onError: () => {},
            onLog: () => {},
            onWorkspaceEvent: (event) => {
              if (event.type === 'workspace.synthesized' && typeof event.data === 'string') {
                current += event.data as string
                setMessages((prev) => prev.map((m) => (m.id === synId ? { ...m, content: current } : m)))
              }
            },
          },
          undefined,
        )
        if (!current.trim()) {
          setMessages((prev) => prev.filter((m) => m.id !== synId))
          return null
        }
        // Keep synthesized content out of thread (it's a view, not a turn) but
        // keep it debuggable via messages; future Redis store could log it.
        return current
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== synId))
        return null
      }
    },
    [],
  )

  const settle = useCallback(
    async (wId: string, correlationId: string, session: number) => {
      // Paused for ask-inline or @user — the human owns the next step.
      if (pausedRef.current) return
      if (session === sessionRef.current) {
        await runSynthesis(wId, correlationId)
      }
      if (session === sessionRef.current) {
        setWorkspaceState('done')
        ping('Workspace run finished.')
      }
    },
    [runSynthesis, ping],
  )

  const stop = useCallback(() => {
    sessionRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    clearPause()
    queueRef.current = []
    setWorkspaceState('done')
  }, [clearPause])

  const reset = useCallback(() => {
    sessionRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setStatusMap({})
    setWorkspaceState('idle')
    clearPause()
    queueRef.current = []
    historyRef.current = []
    hopsRef.current = 0
    lastTurnRef.current = null
    setError(null)
    setWorkspaceId(null)
    threadRef.current = []
    specRef.current = null
    budgetRef.current = TURN_BUDGET_DEFAULT
    turnCounterRef.current = 0
    correlationRef.current = null
    setActiveWorkspaceId(null)
  }, [clearPause])

  const runCommand = useCallback(
    async (
      name: string,
      args: string,
      unknown: boolean,
      wId: string,
      correlationId: string,
      session: number,
    ): Promise<'handled' | 'passthrough'> => {
      if (name === 'stop') {
        stop()
        return 'handled'
      }
      if (name === 'new') {
        reset()
        return 'handled'
      }
      if (unknown) {
        pushCommand(`Unknown command \`/${name}\` — try \`/help\`.`)
        return 'handled'
      }
      if (name === 'summarize') {
        await runSynthesis(wId, correlationId)
        return 'handled'
      }
      if (name === 'retry') {
        const last = lastTurnRef.current
        if (!last) {
          pushCommand('Nothing to retry yet.')
          return 'handled'
        }
        const raw = await takeTurn(last.memberId, last.task, wId, correlationId)
        if (session !== sessionRef.current) return 'handled'
            const r = await afterTurn(last.memberId, raw, wId, correlationId, session)
            if (r === 'continue') await pump(wId, correlationId, session)
            if (session === sessionRef.current) await settle(wId, correlationId, session)
        return 'handled'
      }
      if (name === 'help') {
        const ids = specRef.current?.memberIds ?? []
        pushCommand(
          `**Commands** — \`/summarize\` \`/continue [hint]\` \`/retry\` \`/plan\` \`/stop\` \`/new\` \`/help\`\n\n**Mentions** — \`@member\` talks directly (mediator skipped)${
            ids.length > 0 ? `: ${ids.map((i) => `\`@${i}\``).join(' ')} \`@user\`` : ''
          }`,
        )
        return 'handled'
      }
      if (name === 'plan') {
        const raw = await takeTurn(
          'the-mediator',
          `List the execution plan for: ${args || specRef.current?.instruction || 'the current workspace goal'}. Reply with ONLY this JSON, no prose: {"members":[{"id":"<member>","task":"<task>","order":0}]}`,
          wId,
          correlationId,
        )
        if (session !== sessionRef.current) return 'handled'
        const plan = parseMediatorPlan(raw, specRef.current?.memberIds ?? [])
        pushCommand(
          plan
            ? `**Plan** — ${plan.members.map((m) => `\`${m.id}\`: ${m.task.slice(0, 120)}`).join('\n')}`
            : 'The mediator returned no usable plan.',
        )
        return 'handled'
      }
      if (name === 'continue') {
        if (pendingRouteRef.current) {
          const p = pendingRouteRef.current
          pendingRouteRef.current = null
          setHandoff(null)
          setWorkspaceState('running')
          queueRef.current.push({ id: p.id, task: args ? `${p.task}\n\nUser hint: ${args}` : p.task })
          await pump(wId, correlationId, session)
          if (session === sessionRef.current) await settle(wId, correlationId, session)
          return 'handled'
        }
        if (args) threadRef.current = [...threadRef.current, { role: 'user', content: args }]
        const last = lastTurnRef.current
        if (!last) {
          pushCommand('Nothing to continue yet — send an instruction first.')
          return 'handled'
        }
        const r = await afterTurn(last.memberId, last.raw, wId, correlationId, session)
        if (r === 'continue') await pump(wId, correlationId, session)
        if (r === 'done' && session === sessionRef.current) await settle(wId, correlationId, session)
        return 'handled'
      }
      return 'passthrough'
    },
    [pushCommand, runSynthesis, takeTurn, afterTurn, pump, settle, stop, reset],
  )

  const start = useCallback(
    async (spec: WorkspaceSpec) => {
      for (const id of spec.memberIds) {
        if (!getAgentById(id)) throw new Error(`Invalid memberId: ${id}`)
      }
      const wId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const correlationId = `ws-corr-${Date.now()}`
      correlationRef.current = correlationId
      const session = ++sessionRef.current
      setWorkspaceId(wId)
      // Show the user instruction as the first bubble so the thread is never
      // empty — previously only agent messages were pushed, so a fresh
      // workspace looked like "no message / instructions not captured".
      setMessages([{ id: `user-${wId}`, memberId: 'user', content: spec.instruction, turnIndex: 0 }])
      setStatusMap({})
      setError(null)
      clearPause()
      setWorkspaceState('running')
      threadRef.current = [{ role: 'user', content: spec.instruction }]
      budgetRef.current = TURN_BUDGET_DEFAULT
      specRef.current = spec
      turnCounterRef.current = 0
      queueRef.current = []
      historyRef.current = []
      hopsRef.current = 0
      lastTurnRef.current = null

      // An empty ping would burn a full round-trip and read as "mid-thought"
      // to members — answer inline, session stays usable for follow-ups.
      if (isEmptyPing(spec.instruction)) {
        pushCommand('That looks empty — tell me the goal in a few words, or mention a member with `@`.')
        setWorkspaceState('done')
        return
      }

      // @-mentions skip the mediator entirely — the user already delegated.
      const direct = parseMentions(spec.instruction, spec.memberIds)
      if (direct.error) {
        setError(direct.error)
        setWorkspaceState('error')
        return
      }

      try {
        if (direct.targets.length > 0) {
          for (const id of direct.targets) {
            if (budgetRef.current <= 0) break
            if (abortRef.current?.signal.aborted) break
            pushRoute({ from: 'user', to: id, confidence: 100, reason: 'direct mention' })
            queueRef.current.push({ id, task: direct.cleanText || 'continue with your lane' })
          }
        } else {
          const mediatorOutput = await takeTurn('the-mediator', spec.instruction, wId, correlationId)
          if (session !== sessionRef.current) return
          const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
          const effective = plan ?? fallbackPlan(spec)
          queueRef.current = effective.members.map((m) => ({ id: m.id, task: m.task }))
        }
        await pump(wId, correlationId, session)
        // Auto-synthesizer on every workspace run — final polished natural answer
        // like Claude Work, using shared thread (the reliable session object).
        if (session === sessionRef.current) {
          await settle(wId, correlationId, session)
        }
      } catch (err) {
        if (session !== sessionRef.current) return
        if ((err as Error).name === 'AbortError') {
          setWorkspaceState('handoff')
          return
        }
        setError(err instanceof Error ? err.message : String(err))
        setWorkspaceState('error')
      } finally {
        if (session === sessionRef.current) abortRef.current = null
      }
    },
    [takeTurn, pushRoute, pushCommand, clearPause, pump, settle],
  )

  const sendIntervention = useCallback(
    async (content: string) => {
      const spec = specRef.current
      if (!workspaceId || !spec) return
      abortRef.current?.abort()
      const session = ++sessionRef.current
      clearPause()
      setWorkspaceState('running')
      setHandoff(null)
      const correlationId = `ws-corr-${Date.now()}`
      correlationRef.current = correlationId
      try {
        if (isEmptyPing(content)) {
          threadRef.current = [...threadRef.current, { role: 'user', content }]
          setMessages((prev) => [...prev, { id: `user-${Date.now()}`, memberId: 'user', content, turnIndex: -1 }])
          pushCommand('That looks empty — tell me the goal in a few words, or mention a member with `@`.')
          if (session === sessionRef.current) setWorkspaceState('done')
          return
        }
        // Local commands never touch the LLM (except the ones that must).
        const cmd = parseWorkspaceCommand(content)
        if (cmd) {
          threadRef.current = [...threadRef.current, { role: 'user', content }]
          setMessages((prev) => [...prev, { id: `user-${Date.now()}`, memberId: 'user', content, turnIndex: -1 }])
          const handled = await runCommand(cmd.name, cmd.args, 'unknown' in cmd, workspaceId, correlationId, session)
          if (handled === 'handled') {
            if (session === sessionRef.current && !pausedRef.current) setWorkspaceState('done')
            return
          }
        }
        // @-mentions skip the mediator entirely.
        const direct = parseMentions(content, spec.memberIds)
        if (direct.error) {
          setError(direct.error)
          setWorkspaceState('error')
          return
        }
        threadRef.current = [...threadRef.current, { role: 'user', content }]
        setMessages((prev) => [...prev, { id: `user-${Date.now()}`, memberId: 'user', content, turnIndex: -1 }])
        if (direct.targets.length > 0) {
          for (const id of direct.targets) {
            if (budgetRef.current <= 0) break
            pushRoute({ from: 'user', to: id, confidence: 100, reason: 'direct mention' })
            queueRef.current.push({ id, task: direct.cleanText || content })
          }
        } else {
          const mediatorOutput = await takeTurn('the-mediator', content, workspaceId, correlationId)
          if (session !== sessionRef.current) return
          const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
          if (plan) {
            queueRef.current = plan.members.map((m) => ({ id: m.id, task: m.task }))
          } else {
            queueRef.current = fallbackPlan(spec).members.map((m) => ({ id: m.id, task: content }))
          }
        }
        await pump(workspaceId, correlationId, session)
        if (session === sessionRef.current) {
          await settle(workspaceId, correlationId, session)
        }
      } catch (err) {
        if (session !== sessionRef.current) return
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setWorkspaceState('error')
      }
    },
    [workspaceId, takeTurn, runCommand, pushRoute, pushCommand, clearPause, pump, settle],
  )

  // Engine cross-references resolved directly — the callback graph is
  // acyclic (engine callbacks are all defined before their consumers).
  const setNotifyEnabled = useCallback((on: boolean) => {
    notifyRef.current = on
    setNotifyEnabledState(on)
    saveNotifyPref(on)
    if (on) void requestNotifyPermission()
  }, [])

  const continueHandoff = useCallback(() => {
    // Ask-inline: resume the chain with the proposed member.
    if (pendingRouteRef.current) {
      const p = pendingRouteRef.current
      pendingRouteRef.current = null
      pausedRef.current = false
      setHandoff(null)
      setWorkspaceState('running')
      const wId = workspaceId
      const correlationId = correlationRef.current ?? `ws-corr-${Date.now()}`
      const session = sessionRef.current
      if (!wId) return
      queueRef.current.push({ id: p.id, task: p.task })
      void (async () => {
        await pump(wId, correlationId, session)
        if (session === sessionRef.current) await settle(wId, correlationId, session)
      })()
      return
    }
    // Awaiting user: continue now with the nudge instead of the timer.
    if (awaitingRef.current) {
      const memberId = awaitingRef.current.memberId
      awaitingRef.current = null
      pausedRef.current = false
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
      nudgeTimerRef.current = null
      setHandoff(null)
      setWorkspaceState('running')
      const wId = workspaceId
      const correlationId = correlationRef.current ?? `ws-corr-${Date.now()}`
      const session = sessionRef.current
      if (!wId) return
      void (async () => {
        try {
          const nudge = await takeTurn(
            memberId,
            'Proceed without the user reply — continue with your best assumption in your lane.',
            wId,
            correlationId,
          )
          if (session !== sessionRef.current) return
          const r = await afterTurn(memberId, nudge, wId, correlationId, session)
          if (r === 'continue') await pump(wId, correlationId, session)
          if (session === sessionRef.current) await settle(wId, correlationId, session)
        } catch {
          // best-effort resume
        }
      })()
      return
    }
    setHandoff(null)
    setWorkspaceState('running')
  }, [workspaceId, takeTurn, afterTurn, pump, settle])

  // 90s @user nudge: the timer only raises the signal — the resume runs here
  // with the latest engine callbacks, keeping the graph acyclic.
  useEffect(() => {
    if (!nudgeSignal) return
    const { memberId, wId, correlationId, session } = nudgeSignal
    void (async () => {
      try {
        const nudge = await takeTurn(
          memberId,
          'The user has not replied. Continue with your best assumption in your lane, briefly, or re-ask once.',
          wId,
          correlationId,
        )
        if (session !== sessionRef.current) return
        const r = await afterTurn(memberId, nudge, wId, correlationId, session)
        if (r === 'continue') await pump(wId, correlationId, session)
        if (session === sessionRef.current) await settle(wId, correlationId, session)
      } catch {
        // nudge is best-effort — the thread already holds the question
      }
    })()
  }, [nudgeSignal, takeTurn, afterTurn, pump, settle])

  return {
    messages,
    statusMap,
    workspaceState,
    handoff,
    error,
    workspaceId,
    notifyEnabled,
    setNotifyEnabled,
    start,
    sendIntervention,
    stop,
    reset,
    continueHandoff,
  }
}
