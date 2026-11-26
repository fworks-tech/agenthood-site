import { NextRequest } from 'next/server'
import { getAgentById } from '@/app/(main)/studio/_data/agents'
import { createWorkspaceTurnStream } from '@/app/_lib/studio-server/workspace-adapter'
import { logger } from '@/app/_lib/studio-server/logger'
import { emitLogEvent } from '@/app/_lib/studio-server/trace'
import { getWorkspaceAsync, saveWorkspaceAsync } from '@/app/(main)/studio/_lib/workspace-store'
import { StudioError } from '@/app/(main)/studio/_lib/errors'
import { providerFailure } from '@/app/_lib/studio-server/zen'
import { generateId } from '@/app/(main)/studio/_lib/ids'
import {
  validateTurnstile,
  createCaptchaCookieValue,
  getCaptchaCookieAttributes,
  parseCaptchaCookie,
} from '@/app/_lib/studio-server/captcha'

import {
  MAX_MEMBER_IDS,
  isBoundedId,
} from '@/app/(main)/studio/_lib/limits'
import {
  MAX_INSTRUCTION_CHARS,
  buildSseHeaders,
  makeWorkspaceEvent,
  newWorkspaceIds,
  validateIdFields,
  validateThread,
} from '@/app/(main)/studio/_lib/workspace-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return new Response(JSON.stringify({ error: `instruction must be at most ${MAX_INSTRUCTION_CHARS} chars`, code: 'VALIDATION_ERROR' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const headerCorrelationId = req.headers.get('x-correlation-id')
  const idError = validateIdFields({
    headerCorrelationId,
    workspaceId: payload.workspaceId,
    correlationId: payload.correlationId,
    memberId: payload.memberId,
  })
  if (idError) {
    return jsonError(idError, 'VALIDATION_ERROR', 400, requestId)
  }
  // Possession of the URL is the capability — never a timestamp-guessable id.
  const { workspaceId, correlationId } = newWorkspaceIds({
    workspaceId: payload.workspaceId,
    correlationId: payload.correlationId,
    headerCorrelationId,
    requestId,
  })

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
  const threadError = validateThread(thread)
  if (threadError) {
    return new Response(JSON.stringify({ error: threadError, code: 'VALIDATION_ERROR' }), {
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
        const started = makeWorkspaceEvent('workspace.started', { instruction, members: memberIds }, { workspaceId, correlationId })
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
          const doneEvt = makeWorkspaceEvent('workspace.done', { totalCost: 0, turns: turnIndex + 1, result: 'ok' }, { workspaceId, correlationId })
          controller.enqueue(enc.encode(JSON.stringify(doneEvt) + '\n'))
          doneSent = true
        } catch (readErr) {
          const msg = readErr instanceof Error ? readErr.message : String(readErr)
          const reference = generateId()
          const errEvt = makeWorkspaceEvent('workspace.error', { data: providerFailure(msg, reference).message, requestId: reference }, { workspaceId, correlationId })
          controller.enqueue(enc.encode(JSON.stringify(errEvt) + '\n'))
          logger.error('workspace.stream_read_error', { workspaceId, correlationId, error: msg, requestId: reference })
        } finally {
          if (!doneSent) {
            const doneEvt = makeWorkspaceEvent('workspace.done', { totalCost: 0, turns: turnIndex + 1, result: 'interrupted' }, { workspaceId, correlationId })
            controller.enqueue(enc.encode(JSON.stringify(doneEvt) + '\n'))
          }
          controller.close()
        }
      },
    })

    const headers: Record<string, string> = buildSseHeaders({ requestId, workspaceId, correlationId })
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
