export const TURN_BUDGET_DEFAULT = 10

export type WorkspaceSpec = {
  memberIds: string[]
  instruction: string
}

export type WorkspaceStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'done'

export type WorkspaceTurn = {
  memberId: string
  turnIndex: number
  task?: string
  decision?: 'pass' | 'handoff' | 'failed'
}

export type MediatorPlan = {
  members: { id: string; task: string; order: number }[]
}

export type WorkspaceEvent =
  | { type: 'workspace.started'; instruction: string; members: string[]; workspaceId: string; correlationId: string }
  | { type: 'workspace.turn_start'; memberId: string; role: string; turnIndex: number; plan?: MediatorPlan; workspaceId: string; correlationId: string }
  | { type: 'workspace.token'; memberId: string; data: string; workspaceId: string; correlationId: string }
  | { type: 'workspace.tool_call'; memberId: string; id: string; name: string; args: Record<string, unknown>; workspaceId: string; correlationId: string }
  | { type: 'workspace.tool_result'; memberId: string; id: string; name: string; result: string; error?: string; workspaceId: string; correlationId: string }
  | { type: 'workspace.turn_end'; memberId: string; decision: 'pass' | 'handoff' | 'failed'; cost?: number; workspaceId: string; correlationId: string }
  | { type: 'workspace.status'; memberId: string; status: WorkspaceStatus; workspaceId: string; correlationId: string }
  | { type: 'workspace.handoff'; memberId: string; reason: string; options: ['continue', 'stop']; workspaceId: string; correlationId: string }
  | { type: 'workspace.done'; totalCost: number; turns: number; result: string; workspaceId: string; correlationId: string }
  | { type: 'workspace.error'; data: string; workspaceId: string; correlationId: string }

export type WorkspaceLogEvent = {
  level: 'info' | 'warn' | 'error'
  event: string
  workspaceId: string
  turnIndex?: number
  memberId?: string
  correlationId: string
  [key: string]: unknown
}
