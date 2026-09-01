import { NextRequest } from 'next/server'
import { getAgentById } from '@/app/(main)/studio/_data/agents'
import { createWorkspaceTurnStream } from '@/app/(main)/studio/_lib/workspace-adapter'
import { logger } from '@/app/(main)/studio/_lib/logger'
import { emitLogEvent } from '@/app/(main)/studio/_lib/trace'
import { getWorkspace, saveWorkspace } from '@/app/(main)/studio/_lib/workspace-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_THREAD_MESSAGES = 200
const MAX_MESSAGE_CHARS = 20_000

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: 'workspaceId required', code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const session = getWorkspace(workspaceId)
  if (!session) {
    return new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const payload = body as {
    memberIds?: unknown
    instruction?: unknown
    workspaceId?: unknown
    memberId?: unknown
    turnIndex?: unknown
    thread?: unknown
    correlationId?: unknown
  }

  const memberIds = payload.memberIds
  const instruction = payload.instruction

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return new Response(JSON.stringify({ error: 'memberIds must be a non-empty array', code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  for (const id of memberIds) {
    if (typeof id !== 'string' || !getAgentById(id)) {
      return new Response(JSON.stringify({ error: `Invalid memberId: ${String(id)}`, code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'instruction is required', code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (instruction.length > 4000) {
    return new Response(JSON.stringify({ error: 'instruction must be at most 4000 chars', code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const workspaceId =
    typeof payload.workspaceId === 'string' && payload.workspaceId.length > 0
      ? payload.workspaceId
      : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const correlationId =
    typeof payload.correlationId === 'string' && payload.correlationId.length > 0
      ? payload.correlationId
      : (req.headers.get('x-correlation-id') ?? `ws-corr-${Date.now()}`)

  const memberId =
    typeof payload.memberId === 'string' && payload.memberId.length > 0 ? payload.memberId : memberIds[0]
  const turnIndex = typeof payload.turnIndex === 'number' ? payload.turnIndex : 0
  const thread = Array.isArray(payload.thread) ? (payload.thread as { role: string; content: string }[]) : []

  // Only conversational roles are allowed from the client — a forged system
  // message could otherwise override the member system prompt (prompt injection).
  const VALID_ROLES = ['user', 'assistant', 'tool']
  if (thread.length > MAX_THREAD_MESSAGES) {
    return new Response(JSON.stringify({ error: `thread must have at most ${MAX_THREAD_MESSAGES} messages`, code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  for (const m of thread) {
    if (typeof m.role !== 'string' || !VALID_ROLES.includes(m.role)) {
      return new Response(JSON.stringify({ error: 'thread contains an invalid role', code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS) {
      return new Response(JSON.stringify({ error: `thread messages must be strings of at most ${MAX_MESSAGE_CHARS} chars`, code: 'VALIDATION_ERROR' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  logger.info('workspace.request', { workspaceId, memberId, turnIndex, correlationId, members: memberIds })

  // Server-side session store — reliable shared memory (Map + client localStorage mirror).
  // Upsert incoming thread so GET can rehydrate after reload; client also persists full
  // session via workspace-store saveWorkspace after each turn (future Redis swaps Map).
  try {
    const existing = getWorkspace(workspaceId)
    const sessionToSave = existing ?? {
      workspaceId,
      correlationId,
      spec: { memberIds: memberIds as string[], instruction: instruction as string },
      thread: thread as { role: 'user' | 'assistant' | 'tool'; content: string }[],
      messages: [],
      statusMap: {},
      memory: { goal: instruction as string, scratchpad: {}, decisions: [], artifacts: [] },
      budgetLeft: 30,
      turnCounter: turnIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    // always refresh thread from latest client (client is source of truth for chat)
    sessionToSave.thread = thread as { role: 'user' | 'assistant' | 'tool'; content: string }[]
    sessionToSave.correlationId = correlationId
    sessionToSave.turnCounter = turnIndex
    sessionToSave.updatedAt = Date.now()
    saveWorkspace(sessionToSave)
  } catch {
    // store best-effort
  }

  try {
    const baseStream = await createWorkspaceTurnStream(
      {
        workspaceId,
        correlationId,
        memberId,
        instruction,
        thread: thread.map((m) => ({ role: m.role as never, content: m.content })),
        turnIndex,
      },
      req.signal,
    )

    const wrapped = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        const started = {
          type: 'workspace.started',
          instruction,
          members: memberIds,
          workspaceId,
          correlationId,
        }
        controller.enqueue(enc.encode(JSON.stringify(started) + '\n'))
        emitLogEvent(controller as unknown as ReadableStreamDefaultController<Uint8Array>, 'info', 'workspace.started', {
          workspaceId,
          correlationId,
          members: memberIds,
        } as unknown as Record<string, unknown>)

        const reader = baseStream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
          const doneEvt = { type: 'workspace.done', totalCost: 0, turns: turnIndex + 1, result: 'ok', workspaceId, correlationId }
          controller.enqueue(enc.encode(JSON.stringify(doneEvt) + '\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(wrapped, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'x-correlation-id': correlationId,
        'x-workspace-id': workspaceId,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('workspace.error', { workspaceId, correlationId, error: msg })
    return new Response(JSON.stringify({ error: msg, code: 'WORKSPACE_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
