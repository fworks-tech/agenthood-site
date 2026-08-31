import { TURN_BUDGET_DEFAULT, type MediatorPlan, type WorkspaceSpec } from '../_types/workspace'

export { TURN_BUDGET_DEFAULT }

export type ThreadMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }

const MAX_THREAD_CHARS = 100_000

export function parseMediatorPlan(raw: string, validIds: string[]): MediatorPlan | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const jsonStart = stripped.indexOf('{')
  const jsonEnd = stripped.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) return null
  const candidate = stripped.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(candidate) as MediatorPlan
    if (!parsed.members || !Array.isArray(parsed.members)) return null
    const validated = parsed.members.filter(
      (m) => typeof m.id === 'string' && typeof m.task === 'string' && typeof m.order === 'number' && validIds.includes(m.id),
    )
    if (validated.length === 0) return null
    validated.sort((a, b) => a.order - b.order)
    return { members: validated }
  } catch {
    return null
  }
}

export function fallbackPlan(spec: WorkspaceSpec): MediatorPlan {
  return {
    members: spec.memberIds.map((id, idx) => ({ id, task: spec.instruction, order: idx })),
  }
}

export function trimThread(messages: ThreadMessage[], maxChars = MAX_THREAD_CHARS): ThreadMessage[] {
  let total = messages.reduce((n, m) => n + m.content.length, 0)
  if (total <= maxChars) return messages
  const trimmed = [...messages]
  while (trimmed.length > 1 && total > maxChars) {
    const removed = trimmed.shift()
    if (removed) total -= removed.content.length
  }
  return trimmed
}

export function buildMemberMessages(systemPrompt: string, thread: ThreadMessage[]): ThreadMessage[] {
  const trimmed = trimThread(thread)
  return [{ role: 'system', content: systemPrompt }, ...trimmed]
}

export type OrchestratorState = {
  plan: MediatorPlan
  executed: number
  turnIndex: number
}

export function createInitialState(spec: WorkspaceSpec, plan: MediatorPlan | null): OrchestratorState {
  const effective = plan ?? fallbackPlan(spec)
  return { plan: effective, executed: 0, turnIndex: 0 }
}

export function isBudgetExhausted(state: OrchestratorState, budget = TURN_BUDGET_DEFAULT): boolean {
  return state.executed >= budget
}

export function getNextMember(state: OrchestratorState): { member: MediatorPlan['members'][number] | null; done: boolean } {
  if (state.turnIndex >= state.plan.members.length) return { member: null, done: true }
  return { member: state.plan.members[state.turnIndex], done: false }
}

export function advanceState(state: OrchestratorState): OrchestratorState {
  return { ...state, turnIndex: state.turnIndex + 1, executed: state.executed + 1 }
}

export function shouldRequestHandoff(toolName: string): boolean {
  return toolName === 'code_execution'
}
