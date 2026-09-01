'use client'

import { useCallback, useRef, useState } from 'react'
import { readSSEStream } from '../_lib/stream'
import { parseMediatorPlan, fallbackPlan, type ThreadMessage } from '../_lib/workspace-orchestrator'
import { isUsefulPolished, toPolished } from '../_lib/workspace-polish'
import { TURN_BUDGET_DEFAULT, type WorkspaceSpec, type WorkspaceStatus } from '../_types/workspace'
import { getAgentById } from '../_data/agents'

export type WorkspaceToolCall = { id: string; name: string; args: Record<string, unknown>; result?: string; error?: string; status: 'running' | 'complete' | 'error' }
export type WorkspaceMessage = { id: string; memberId: string; content: string; turnIndex: number; toolCalls?: WorkspaceToolCall[] }

export type WorkspaceState = 'idle' | 'running' | 'handoff' | 'done' | 'error'

export function useWorkspace() {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, WorkspaceStatus>>({})
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('idle')
  const [handoff, setHandoff] = useState<{ memberId: string; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const threadRef = useRef<ThreadMessage[]>([])
  const budgetRef = useRef(TURN_BUDGET_DEFAULT)
  const specRef = useRef<WorkspaceSpec | null>(null)
  // Monotonic turn counter — unique message ids + trace turn index across the whole session.
  const turnCounterRef = useRef(0)
  // Session token: only the latest start/intervention may write terminal state.
  const sessionRef = useRef(0)

  const updateStatus = useCallback((memberId: string, status: WorkspaceStatus) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }))
  }, [])

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

      threadRef.current = [...threadRef.current, { role: 'assistant', content: toPolished(currentContent) || currentContent }]
      updateStatus(memberId, 'done')
      return currentContent
    },
    [updateStatus],
  )

  const start = useCallback(
    async (spec: WorkspaceSpec) => {
      for (const id of spec.memberIds) {
        if (!getAgentById(id)) throw new Error(`Invalid memberId: ${id}`)
      }
      const wId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const correlationId = `ws-corr-${Date.now()}`
      const session = ++sessionRef.current
      setWorkspaceId(wId)
      // Show the user instruction as the first bubble so the thread is never
      // empty — previously only agent messages were pushed, so a fresh
      // workspace looked like "no message / instructions not captured".
      setMessages([{ id: `user-${wId}`, memberId: 'user', content: spec.instruction, turnIndex: 0 }])
      setStatusMap({})
      setError(null)
      setHandoff(null)
      setWorkspaceState('running')
      threadRef.current = [{ role: 'user', content: spec.instruction }]
      budgetRef.current = TURN_BUDGET_DEFAULT
      specRef.current = spec
      turnCounterRef.current = 0

      try {
        const mediatorOutput = await runTurn('the-mediator', spec.instruction, ++turnCounterRef.current, wId, correlationId)
        if (session !== sessionRef.current) return
        const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
        const effective = plan ?? fallbackPlan(spec)

        // Live collaboration — round-robin through the plan until budget
        // exhausted so every member gets to contribute and validate. The
        // previous implementation stopped after one pass, which left the
        // chat with only "Let me check..." thinking messages (see sim2).
        // Now we keep chatting; intermediate thinking is shown as
        // "is thinking..." in the card/typing indicator, and the loop
        // continues with an auto-nudge until a useful answer appears.
        // No hard round cap — budget (30) is the only limiter for cost.
        let rounds = 0
        while (budgetRef.current > 0) {
          let roundHadUseful = false
          for (const member of effective.members) {
            if (budgetRef.current <= 0) break
            if (abortRef.current?.signal.aborted) break
            budgetRef.current -= 1
            const raw = await runTurn(member.id, member.task, ++turnCounterRef.current, wId, correlationId)
            if (session !== sessionRef.current) return
            if (isUsefulPolished(toPolished(raw))) {
              roundHadUseful = true
            }
          }
          if (abortRef.current?.signal.aborted) break
          if (budgetRef.current <= 0) break
          // If nobody was useful this round, nudge and continue live chat
          if (!roundHadUseful) {
            threadRef.current = [
              ...threadRef.current,
              {
                role: 'user',
                content:
                  'Your previous response was only reasoning ("Let me check..."). Now deliver the final improvement for the repo with concrete, copy-pasteable code snippets and tests. Keep collaborating until the answer is complete.',
              },
            ]
          } else {
            // Found a useful answer — stop the live loop and let the user
            // intervene for further validation if needed
            break
          }
          rounds++
          // Safety: never spin forever if budget is large
          if (rounds > 8) break
        }
        if (session === sessionRef.current) setWorkspaceState('done')
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
    [runTurn],
  )

  const sendIntervention = useCallback(
    async (content: string) => {
      const spec = specRef.current
      if (!workspaceId || !spec) return
      abortRef.current?.abort()
      const session = ++sessionRef.current
      threadRef.current = [...threadRef.current, { role: 'user', content }]
      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, memberId: 'user', content, turnIndex: -1 }])
      setWorkspaceState('running')
      setHandoff(null)
      const correlationId = `ws-corr-${Date.now()}`
      try {
        const mediatorOutput = await runTurn('the-mediator', content, ++turnCounterRef.current, workspaceId, correlationId)
        if (session !== sessionRef.current) return
        const plan = parseMediatorPlan(mediatorOutput, spec.memberIds)
        if (plan) {
          for (const m of plan.members) {
            if (budgetRef.current <= 0) break
            budgetRef.current -= 1
            await runTurn(m.id, m.task, ++turnCounterRef.current, workspaceId, correlationId)
          }
        }
        if (session === sessionRef.current) setWorkspaceState('done')
      } catch (err) {
        if (session !== sessionRef.current) return
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setWorkspaceState('error')
      }
    },
    [workspaceId, runTurn],
  )

  const stop = useCallback(() => {
    sessionRef.current++
    abortRef.current?.abort()
    setWorkspaceState('done')
  }, [])

  const continueHandoff = useCallback(() => {
    setHandoff(null)
    setWorkspaceState('running')
  }, [])

  return {
    messages,
    statusMap,
    workspaceState,
    handoff,
    error,
    workspaceId,
    start,
    sendIntervention,
    stop,
    continueHandoff,
  }
}