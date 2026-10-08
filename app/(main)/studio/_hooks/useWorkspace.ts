'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readSSEStream } from '../_lib/stream'
import { parseWorkspaceCommand } from '../_lib/workspace-commands'
import { notifyWorkspace, loadNotifyPref, saveNotifyPref, requestNotifyPermission } from '../_lib/workspace-notify'
import {
  createEngineState,
  clearPause as clearEnginePause,
  resetEngineState,
  type EngineState,
  type NudgePayload,
} from '../_lib/workspace-engine'
import { startRun, intervene, resumePending, resumeAfterNudge } from '../_lib/workspace-runs'
import { suggestReactions, toggleReaction as toggleReactionList } from '../_lib/workspace-reactions'
import { TURN_BUDGET_DEFAULT, type WorkspaceSpec, type WorkspaceStatus, type WorkspaceMessage, type WorkspaceReaction } from '../_types/workspace'
import type { ThreadMessage } from '../_lib/workspace-orchestrator'
import { getAgentById } from '../_data/agents'
import { getActiveWorkspaceId, getWorkspace, saveWorkspace, setActiveWorkspaceId } from '../_lib/workspace-store'

export type WorkspaceToolCall = { id: string; name: string; args: Record<string, unknown>; result?: string; error?: string; status: 'running' | 'complete' | 'error' }
export type { WorkspaceMessage }

export type WorkspaceState = 'idle' | 'running' | 'handoff' | 'done' | 'error'

const NUDGE_PROCEED_PROMPT = 'Proceed without the user reply — continue with your best assumption in your lane.'
const NUDGE_TIMEOUT_PROMPT = 'The user has not replied. Continue with your best assumption in your lane, briefly, or re-ask once.'

export function useWorkspace() {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, WorkspaceStatus>>({})
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('idle')
  const [handoff, setHandoff] = useState<{ memberId: string; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [notifyEnabled, setNotifyEnabledState] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  // Chain engine state: queue, history, guards, pause points, thread, budget.
  const engineRef = useRef<EngineState>(createEngineState(TURN_BUDGET_DEFAULT))
  // Session token: only the latest start/intervention may write terminal state.
  const sessionRef = useRef(0)
  const specRef = useRef<WorkspaceSpec | null>(null)
  const correlationRef = useRef<string | null>(null)
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

  const pushRoute = useCallback((route: { from: string; to: string; confidence: number; reason: string }) => {
    const id = `route-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages((prev) => [...prev, { id, memberId: 'router', content: '', turnIndex: engineRef.current.turnCounter, route }])
  }, [])

  const pushCommand = useCallback((content: string) => {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages((prev) => [...prev, { id, memberId: 'command', content, turnIndex: engineRef.current.turnCounter }])
  }, [])

  const pushUserBubble = useCallback((content: string) => {
    const roster = specRef.current?.memberIds ?? []
    const reactions = roster.length > 0 ? suggestReactions({ content, authorId: 'user', memberIds: roster }) : []
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, memberId: 'user', content, turnIndex: -1, reactions },
    ])
  }, [])

  const pushReaction = useCallback((messageId: string, reactions: WorkspaceReaction[]) => {
    if (reactions.length === 0) return
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, reactions: [...(m.reactions ?? []), ...reactions] } : m,
      ),
    )
  }, [])

  const toggleMessageReaction = useCallback((messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: toggleReactionList(m.reactions, emoji, 'user') } : m)),
    )
  }, [])

  const showHandoff = useCallback((memberId: string, reason: string) => {
    setHandoff({ memberId, reason })
    setWorkspaceState('handoff')
  }, [])

  const clearHandoff = useCallback(() => {
    setHandoff(null)
  }, [])

  const setRunning = useCallback(() => {
    setHandoff(null)
    setWorkspaceState('running')
  }, [])

  const setDone = useCallback(() => {
    setWorkspaceState('done')
  }, [])

  const fail = useCallback((message: string) => {
    setError(message)
    setWorkspaceState('error')
  }, [])

  const pauseOnAbort = useCallback(() => {
    setWorkspaceState('handoff')
  }, [])

  const getSpec = useCallback(() => specRef.current, [])

  const scheduleNudge = useCallback((ms: number, fire: () => void) => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
    nudgeTimerRef.current = setTimeout(fire, ms)
  }, [])

  const clearNudge = useCallback(() => {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
    nudgeTimerRef.current = null
  }, [])

  const isAborted = useCallback(() => abortRef.current?.signal.aborted ?? false, [])

  const isCurrentSession = useCallback((s: number) => s === sessionRef.current, [])

  const onNudge = useCallback((payload: NudgePayload) => setNudgeSignal(payload), [])

  const displayName = useCallback((memberId: string) => getAgentById(memberId)?.name ?? memberId, [])

  const clearPause = useCallback(
    (opts?: { keepPending?: boolean }) => {
      clearEnginePause(engineRef.current, { clearNudge, clearHandoff }, opts)
    },
    [clearNudge, clearHandoff],
  )

  const stop = useCallback(() => {
    sessionRef.current++
    abortRef.current?.abort()
    abortRef.current = null
    clearPause()
    engineRef.current.queue = []
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
    resetEngineState(engineRef.current, TURN_BUDGET_DEFAULT)
    setError(null)
    setWorkspaceId(null)
    specRef.current = null
    correlationRef.current = null
    setActiveWorkspaceId(null)
  }, [clearPause])

  // Hydrate from workspace-store on mount — same session as useStudioChat, so reload preserves chat.
  useEffect(() => {
    const activeId = getActiveWorkspaceId()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifyEnabledState(loadNotifyPref())
    notifyRef.current = loadNotifyPref()
    if (!activeId) return
    const sess = getWorkspace(activeId)
    if (!sess) return
    // Legacy synthesizer cards never render — drop them on hydrate.
    setMessages(sess.messages.filter((m) => m.memberId !== 'synthesizer'))
    setStatusMap(sess.statusMap)
    setWorkspaceId(sess.workspaceId)
    engineRef.current.thread = sess.thread
    specRef.current = sess.spec
    engineRef.current.budget = sess.budgetLeft
    engineRef.current.turnCounter = sess.turnCounter
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
      thread: engineRef.current.thread,
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
      budgetLeft: engineRef.current.budget,
      turnCounter: engineRef.current.turnCounter,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setActiveWorkspaceId(workspaceId)
  }, [messages, statusMap, workspaceId])

  // Transport: streams one member turn into messages; thread writes are engine policy.
  const streamTurn = useCallback(
    async (
      memberId: string,
      instruction: string,
      turnIndex: number,
      wId: string,
      correlationId: string,
      thread: ThreadMessage[],
    ) => {
      const controller = new AbortController()
      abortRef.current = controller
      updateStatus(memberId, 'working')

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
          workspaceMemberIds: specRef.current?.memberIds ?? [memberId],
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

      updateStatus(memberId, 'done')
      // Parse [reaction] tags from the raw output and strip them from content.
      const reactionMatches = [...currentContent.matchAll(/\[reaction\]\s+(@\S+)\s+(\S+)/g)]
      if (reactionMatches.length > 0) {
        const cleaned = currentContent.replace(/\[reaction\]\s+@\S+\s+\S+\n?/g, '').trim()
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: cleaned } : m)))
        for (const match of reactionMatches) {
          const targetId = match[1].replace(/^@/, '')
          // Find the target message by memberId in the thread
          const targetMsg = messages.find((m) => m.memberId === targetId)
          if (targetMsg) {
            pushReaction(targetMsg.id, [{ emoji: match[2], byMemberId: memberId }])
          }
        }
      }
      return reactionMatches.length > 0 ? currentContent.replace(/\[reaction\]\s+@\S+\s+\S+\n?/g, '').trim() : currentContent
    },
    [updateStatus, pushReaction, messages],
  )

  const runSynthesis = useCallback(async () => {
    // Synthesis disabled: group-chat model shows only user + member turns.
    return null
  }, [])

  // Injected engine context: the single seam between React and the chain engine.
  const engineCtx = useMemo(
    () => ({
      streamTurn,
      runSynthesis,
      pushRoute,
      pushReaction,
      pushNote: pushCommand,
      pushUserBubble,
      showHandoff,
      clearHandoff,
      setRunning,
      setDone,
      fail,
      pauseOnAbort,
      requestStop: stop,
      requestReset: reset,
      notify: ping,
      displayName,
      getSpec,
      scheduleNudge,
      clearNudge,
      isAborted,
      isCurrentSession,
      onNudge,
    }),
    [
      streamTurn,
      runSynthesis,
      pushRoute,
      pushReaction,
      pushCommand,
      pushUserBubble,
      showHandoff,
      clearHandoff,
      setRunning,
      setDone,
      fail,
      pauseOnAbort,
      stop,
      reset,
      ping,
      displayName,
      getSpec,
      scheduleNudge,
      clearNudge,
      isAborted,
      isCurrentSession,
      onNudge,
    ],
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
      const state = engineRef.current
      setWorkspaceId(wId)
      const ack = suggestReactions({ content: spec.instruction, authorId: 'user', memberIds: spec.memberIds })
      setMessages([{ id: `user-${wId}`, memberId: 'user', content: spec.instruction, turnIndex: 0, reactions: ack }])
      setStatusMap({})
      setError(null)
      clearPause()
      setWorkspaceState('running')
      // Full engine reset — a fresh run must not inherit the previous run's
      // retry marker, or the first thinking-only answer skips its one retry
      // when the turn counter lands on the same index again.
      resetEngineState(state, TURN_BUDGET_DEFAULT)
      state.thread = [{ role: 'user', content: spec.instruction }]
      specRef.current = spec

      await startRun(state, spec, wId, correlationId, session, engineCtx)
      if (session === sessionRef.current) abortRef.current = null
    },
    [clearPause, engineCtx],
  )

  const sendIntervention = useCallback(
    async (content: string) => {
      const spec = specRef.current
      if (!workspaceId || !spec) return
      abortRef.current?.abort()
      const session = ++sessionRef.current
      // Group-chat ownership: never wipe the awaiting owner here — intervene()
      // routes the reply back to that member first. Only /continue keeps
      // the ask-inline proposal; everything else is owned by intervene.
      const awaiting = engineRef.current.awaiting
      const cmdPreview = parseWorkspaceCommand(content)
      clearPause(cmdPreview?.name === 'continue' ? { keepPending: true } : undefined)
      if (awaiting && cmdPreview?.name !== 'continue') {
        engineRef.current.awaiting = awaiting
        engineRef.current.paused = true
      }
      setWorkspaceState('running')
      setHandoff(null)
      const correlationId = `ws-corr-${Date.now()}`
      correlationRef.current = correlationId
      await intervene(engineRef.current, content, workspaceId, correlationId, session, engineCtx)
    },
    [workspaceId, clearPause, engineCtx],
  )

  const setNotifyEnabled = useCallback((on: boolean) => {
    notifyRef.current = on
    setNotifyEnabledState(on)
    saveNotifyPref(on)
    if (on) void requestNotifyPermission()
  }, [])

  const continueHandoff = useCallback(() => {
    if (engineRef.current.pendingRoute) {
      const wId = workspaceId
      const correlationId = correlationRef.current ?? `ws-corr-${Date.now()}`
      const session = sessionRef.current
      if (!wId) return
      void resumePending(engineRef.current, wId, correlationId, session, engineCtx)
      return
    }
    if (engineRef.current.awaiting) {
      const memberId = engineRef.current.awaiting.memberId
      engineRef.current.awaiting = null
      engineRef.current.paused = false
      clearNudge()
      setHandoff(null)
      setWorkspaceState('running')
      const wId = workspaceId
      const correlationId = correlationRef.current ?? `ws-corr-${Date.now()}`
      const session = sessionRef.current
      if (!wId) return
      void resumeAfterNudge(engineRef.current, memberId, NUDGE_PROCEED_PROMPT, wId, correlationId, session, engineCtx)
      return
    }
    setHandoff(null)
    setWorkspaceState('running')
  }, [workspaceId, clearNudge, engineCtx])

  useEffect(() => {
    if (!nudgeSignal) return
    const { memberId, wId, correlationId, session } = nudgeSignal
    void resumeAfterNudge(engineRef.current, memberId, NUDGE_TIMEOUT_PROMPT, wId, correlationId, session, engineCtx)
  }, [nudgeSignal, engineCtx])

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
    toggleMessageReaction,
    stop,
    reset,
    continueHandoff,
  }
}
