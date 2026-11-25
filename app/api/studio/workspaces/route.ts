import { NextRequest } from 'next/server'
import { getAgentById } from '@/app/(main)/studio/_data/agents'
import { createWorkspaceTurnStream } from '@/app/(main)/studio/_lib/workspace-adapter'
import { logger } from '@/app/(main)/studio/_lib/logger'
import { emitLogEvent } from '@/app/(main)/studio/_lib/trace'
import { getWorkspaceAsync, saveWorkspaceAsync } from '@/app/(main)/studio/_lib/workspace-store'
import { StudioError } from '@/app/(main)/studio/_lib/errors'
import { providerFailure } from '@/app/(main)/studio/_lib/zen'
import { generateId } from '@/app/(main)/studio/_lib/ids'
import {
  validateTurnstile,
  createCaptchaCookieValue,
  getCaptchaCookieAttributes,
  parseCaptchaCookie,
} from '@/app/(main)/studio/_lib/captcha'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_THREAD_MESSAGES = 200
const MAX_MESSAGE_CHARS = 20_000
const MAX_THREAD_TOTAL_CHARS = 100_000
const MAX_MEMBER_IDS = 20
const MAX_ID_LENGTH = 128
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

function isBoundedId(value: string): boolean {
  const id = value.trim()
  return id.length > 0 && id.length <= MAX_ID_LENGTH && !CONTROL_CHARS.test(id)
}

function jsonError(error: string, code: string, status: number, requestId?: string) {
  return Response.json({ error, code, ...(requestId ? { requestId } : {}) }, { status })
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId || !isBoundedId(workspaceId)) {
    return jsonError('workspaceId required', 'VALIDATION_ERROR', 400)
  }
  const session = await getWorkspaceAsync(workspaceId.trim())
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
  const requestId = generateId()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON', 'VALIDATION_ERROR', 400, requestId)
  }

  const payload = body as {
    memberIds?: unknown
    instruction?: unknown
    workspaceId?: unknown
    memberId?: unknown
    turnIndex?: unknown
    thread?: unknown
    correlationId?: unknown
    workspaceMemberIds?: unknown
    turnstileToken?: unknown
  }

  let didVerify = false
  try {
    didVerify = await validateTurnstile(payload.turnstileToken, parseCaptchaCookie(req.headers.get('cookie')))
  } catch (err) {
    if (err instanceof StudioError) {
      return jsonError(err.message, err.code, err.statusCode, requestId)
    }
    throw err
  }

  const rawMemberIds = payload.memberIds
  const instruction = payload.instruction

  if (!Array.isArray(rawMemberIds) || rawMemberIds.length === 0) {
    return new Response(JSON.stringify({ error: 'memberIds must be a non-empty array', code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (rawMemberIds.length > MAX_MEMBER_IDS) {
    return jsonError(`memberIds must have at most ${MAX_MEMBER_IDS} items`, 'VALIDATION_ERROR', 400, requestId)
  }
  const memberIds = [...new Set(rawMemberIds)]
  for (const id of memberIds) {
    if (typeof id !== 'string' || !getAgentById(id)) {
      return jsonError(`Invalid memberId: ${String(id)}`, 'VALIDATION_ERROR', 400, requestId)
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

  const headerCorrelationId = req.headers.get('x-correlation-id')
  if (headerCorrelationId !== null && !isBoundedId(headerCorrelationId)) {
    return jsonError('Invalid x-correlation-id header', 'VALIDATION_ERROR', 400, requestId)
  }
  if (payload.workspaceId !== undefined && (typeof payload.workspaceId !== 'string' || !isBoundedId(payload.workspaceId))) {
    return jsonError('Invalid workspaceId', 'VALIDATION_ERROR', 400, requestId)
  }
  if (payload.correlationId !== undefined && (typeof payload.correlationId !== 'string' || !isBoundedId(payload.correlationId))) {
    return jsonError('Invalid correlationId', 'VALIDATION_ERROR', 400, requestId)
  }
  if (payload.memberId !== undefined && (typeof payload.memberId !== 'string' || !isBoundedId(payload.memberId))) {
    return jsonError('Invalid memberId', 'VALIDATION_ERROR', 400, requestId)
  }
  // Possession of the URL is the capability — never a timestamp-guessable id.
  const workspaceId = typeof payload.workspaceId === 'string' && payload.workspaceId.length > 0
    ? payload.workspaceId.trim()
    : `ws-${generateId()}`
  const correlationId = typeof payload.correlationId === 'string' && payload.correlationId.length > 0
    ? payload.correlationId.trim()
    : (headerCorrelationId ?? `ws-corr-${requestId}`)

  const memberId =
    typeof payload.memberId === 'string' && payload.memberId.length > 0 ? payload.memberId : memberIds[0]
  const turnIndex = typeof payload.turnIndex === 'number' ? payload.turnIndex : 0
  const thread = Array.isArray(payload.thread) ? (payload.thread as { role: string; content: string }[]) : []
  const workspaceMemberIds = Array.isArray(payload.workspaceMemberIds)
    ? (payload.workspaceMemberIds as unknown[]).filter(
        (id): id is string => typeof id === 'string' && !!getAgentById(id),
      )
    : null

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
  const totalChars = thread.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : 0), 0)
  if (totalChars > MAX_THREAD_TOTAL_CHARS) {
    return new Response(JSON.stringify({ error: `thread must total at most ${MAX_THREAD_TOTAL_CHARS} chars`, code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  logger.info('workspace.request', { workspaceId, memberId, turnIndex, correlationId, members: memberIds })

  // Upsert incoming thread so GET can rehydrate after reload; Redis-backed on
  // Vercel so the next lambda sees the turn, Map fallback for local dev.
  try {
    const existing = await getWorkspaceAsync(workspaceId)
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
    await saveWorkspaceAsync(sessionToSave)
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
        allowedMembers: workspaceMemberIds ?? undefined,
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
        let doneSent = false
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
          const doneEvt = { type: 'workspace.done', totalCost: 0, turns: turnIndex + 1, result: 'ok', workspaceId, correlationId }
          controller.enqueue(enc.encode(JSON.stringify(doneEvt) + '\n'))
          doneSent = true
        } catch (readErr) {
          const msg = readErr instanceof Error ? readErr.message : String(readErr)
          const reference = generateId()
          const errEvt = { type: 'workspace.error', data: providerFailure(msg, reference).message, requestId: reference, workspaceId, correlationId }
          controller.enqueue(enc.encode(JSON.stringify(errEvt) + '\n'))
          logger.error('workspace.stream_read_error', { workspaceId, correlationId, error: msg, requestId: reference })
        } finally {
          if (!doneSent) {
            const doneEvt = { type: 'workspace.done', totalCost: 0, turns: turnIndex + 1, result: 'interrupted', workspaceId, correlationId }
            controller.enqueue(enc.encode(JSON.stringify(doneEvt) + '\n'))
          }
          controller.close()
        }
      },
    })

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Request-Id': requestId,
      'x-correlation-id': correlationId,
      'x-workspace-id': workspaceId,
    }
    if (didVerify) {
      headers['Set-Cookie'] = `captcha_verified=${await createCaptchaCookieValue()}; ${getCaptchaCookieAttributes()}`
    }
    return new Response(wrapped, { headers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('workspace.error', { workspaceId, correlationId, error: msg, requestId })
    return jsonError(providerFailure(msg, requestId).message, 'WORKSPACE_ERROR', 500, requestId)
  }
}
