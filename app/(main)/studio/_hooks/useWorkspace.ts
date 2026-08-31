'use client'

import { useCallback, useRef, useState } from 'react'
import { readSSEStream } from '../_lib/stream'
import { parseMediatorPlan, fallbackPlan, type ThreadMessage } from '../_lib/workspace-orchestrator'
import { TURN_BUDGET_DEFAULT, type WorkspaceSpec, type WorkspaceStatus, type MediatorPlan } from '../_types/workspace'
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
  const memberIdsRef = useRef<string[]>([])

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
          onToken: (token) => {
            currentContent += token
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: currentContent } : m)))
          },
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
              const list = Array.from(toolCallsMap.values())
              setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, toolCalls: list } : m)))
            }
            if (event.type === 'workspace.tool_result') {
              const id = event.id as string
              const existing = toolCallsMap.get(id)
              const status = event.error ? 'error' : 'complete'
              const updated: WorkspaceToolCall = {
                id,
                name: (event.name as string) ?? existing?.name ?? 'tool',
                args: existing?.args ?? (event.args as Record<string, unknown>) ?? {},
                result: (event.result as string) ?? undefined,
                error: (event.error as string) ?? undefined,
                status: status as WorkspaceToolCall['status'],
              }
              toolCallsMap.set(id, updated)
              const list = Array.from(toolCallsMap.values())
              setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, toolCalls: list } : m)))
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

      threadRef.current = [...threadRef.current, { role: 'assistant', content: currentContent }]
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
      setWorkspaceId(wId)
      setMessages([])
      setStatusMap({})
      setError(null)
      setHandoff(null)
      setWorkspaceState('running')
      threadRef.current = [{ role: 'user', content: spec.instruction }]
      budgetRef.current = TURN_BUDGET_DEFAULT
      memberIdsRef.current = spec.memberIds

      const validIds = spec.memberIds
      let plan: MediatorPlan | null = null

      try {
        const mediatorOutput = await runTurn('the-mediator', spec.instruction, 0, wId, correlationId)
        plan = parseMediatorPlan(mediatorOutput, validIds)
        const effective = plan ?? fallbackPlan(spec)

        let turnIdx = 1
        for (const member of effective.members) {
          if (budgetRef.current <= 0) break
          if (abortRef.current?.signal.aborted) break
          budgetRef.current -= 1
          await runTurn(member.id, member.task, turnIdx, wId, correlationId)
          turnIdx++
        }
        setWorkspaceState('done')
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setWorkspaceState('handoff')
          return
        }
        setError(err instanceof Error ? err.message : String(err))
        setWorkspaceState('error')
      } finally {
        abortRef.current = null
      }
    },
    [runTurn],
  )

  const sendIntervention = useCallback(
    async (content: string) => {
      if (!workspaceId) return
      abortRef.current?.abort()
      threadRef.current = [...threadRef.current, { role: 'user', content }]
      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, memberId: 'user', content, turnIndex: -1 }])
      setWorkspaceState('running')
      setHandoff(null)
      const correlationId = `ws-corr-${Date.now()}`
      try {
        const mediatorOutput = await runTurn('the-mediator', content, 999, workspaceId, correlationId)
        const plan = parseMediatorPlan(mediatorOutput, memberIdsRef.current) ?? null
        if (plan) {
          for (const m of plan.members) {
            if (budgetRef.current <= 0) break
            budgetRef.current -= 1
            await runTurn(m.id, m.task, 1000 + m.order, workspaceId, correlationId)
          }
        }
        setWorkspaceState('done')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setWorkspaceState('error')
      }
    },
    [workspaceId, runTurn],
  )

  const stop = useCallback(() => {
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
