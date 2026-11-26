import { MAX_MESSAGE_CHARS, MAX_THREAD_MESSAGES, MAX_THREAD_TOTAL_CHARS, isBoundedId } from './limits'
import { generateId } from './ids'

// Single home for workspace request validation + SSE envelope. Both
// app/api/studio/workspaces/route.ts and synthesize/route.ts copied this
// preamble; drift between the two already caused one test bug (see limits.ts).
export const VALID_ROLES = ['user', 'assistant', 'tool'] as const

export const MAX_INSTRUCTION_CHARS = 4000

export function newWorkspaceIds(input: {
  workspaceId?: unknown
  correlationId?: unknown
  headerCorrelationId?: string | null
  requestId: string
}): { workspaceId: string; correlationId: string } {
  const workspaceId =
    typeof input.workspaceId === 'string' && input.workspaceId.length > 0
      ? input.workspaceId.trim()
      : `ws-${input.requestId || generateId()}`
  const correlationId =
    typeof input.correlationId === 'string' && input.correlationId.length > 0
      ? input.correlationId.trim()
      : (input.headerCorrelationId ?? `ws-corr-${input.requestId || generateId()}`)
  return { workspaceId, correlationId }
}

// Returns the client-facing error message, or null when ids are valid.
// Order matches the routes: header first, then body fields.
export function validateIdFields(input: {
  headerCorrelationId?: string | null
  workspaceId?: unknown
  correlationId?: unknown
  memberId?: unknown
}): string | null {
  if (input.headerCorrelationId !== undefined && input.headerCorrelationId !== null && !isBoundedId(input.headerCorrelationId)) {
    return 'Invalid x-correlation-id header'
  }
  if (input.workspaceId !== undefined && (typeof input.workspaceId !== 'string' || !isBoundedId(input.workspaceId))) {
    return 'Invalid workspaceId'
  }
  if (input.correlationId !== undefined && (typeof input.correlationId !== 'string' || !isBoundedId(input.correlationId))) {
    return 'Invalid correlationId'
  }
  if (input.memberId !== undefined && (typeof input.memberId !== 'string' || !isBoundedId(input.memberId))) {
    return 'Invalid memberId'
  }
  return null
}

// Stricter route.ts form wins: non-string content and overlong content share
// one message so synthesize cannot drift again.
export function validateThread(thread: unknown): string | null {
  if (!Array.isArray(thread)) return 'thread must be an array'
  if (thread.length > MAX_THREAD_MESSAGES) {
    return `thread must have at most ${MAX_THREAD_MESSAGES} messages`
  }
  for (const m of thread as { role?: unknown; content?: unknown }[]) {
    if (typeof m.role !== 'string' || !(VALID_ROLES as readonly string[]).includes(m.role)) {
      return 'thread contains an invalid role'
    }
    if (typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS) {
      return `thread messages must be strings of at most ${MAX_MESSAGE_CHARS} chars`
    }
  }
  const totalChars = (thread as { content?: unknown }[]).reduce(
    (n, m) => n + (typeof m.content === 'string' ? m.content.length : 0),
    0,
  )
  if (totalChars > MAX_THREAD_TOTAL_CHARS) {
    return `thread must total at most ${MAX_THREAD_TOTAL_CHARS} chars`
  }
  return null
}

export function buildSseHeaders(input: { requestId: string; workspaceId: string; correlationId: string }): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Request-Id': input.requestId,
    'x-correlation-id': input.correlationId,
    'x-workspace-id': input.workspaceId,
  }
}

export function makeWorkspaceEvent(
  type: string,
  data: Record<string, unknown>,
  ids: { workspaceId: string; correlationId: string },
): Record<string, unknown> {
  return { type, ...data, workspaceId: ids.workspaceId, correlationId: ids.correlationId }
}
