import { NextRequest } from 'next/server'
import { createSynthesisStream } from '@/app/_lib/studio-server/workspace-synthesizer'
import type { ThreadMessage } from '@/app/(main)/studio/_lib/workspace-orchestrator'
import { StudioError } from '@/app/(main)/studio/_lib/errors'
import { generateId } from '@/app/(main)/studio/_lib/ids'
import {
  validateTurnstile,
  createCaptchaCookieValue,
  getCaptchaCookieAttributes,
  parseCaptchaCookie,
} from '@/app/_lib/studio-server/captcha'

import {
  MAX_THREAD_MESSAGES,
  MAX_THREAD_TOTAL_CHARS,
  MAX_MESSAGE_CHARS,
  isBoundedId,
} from '@/app/(main)/studio/_lib/limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const requestId = generateId()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON', requestId }, { status: 400 })
  }
  const payload = body as { workspaceId?: unknown; correlationId?: unknown; thread?: unknown; turnstileToken?: unknown }

  let didVerify = false
  try {
    didVerify = await validateTurnstile(payload.turnstileToken, parseCaptchaCookie(req.headers.get('cookie')))
  } catch (err) {
    if (err instanceof StudioError) {
      return Response.json({ error: err.message, code: err.code, requestId }, { status: err.statusCode })
    }
    throw err
  }

  const headerCorrelationId = req.headers.get('x-correlation-id')
  if (headerCorrelationId !== null && !isBoundedId(headerCorrelationId)) {
    return Response.json({ error: 'Invalid x-correlation-id header', requestId }, { status: 400 })
  }
  if (payload.workspaceId !== undefined && (typeof payload.workspaceId !== 'string' || !isBoundedId(payload.workspaceId))) {
    return Response.json({ error: 'Invalid workspaceId', requestId }, { status: 400 })
  }
  if (payload.correlationId !== undefined && (typeof payload.correlationId !== 'string' || !isBoundedId(payload.correlationId))) {
    return Response.json({ error: 'Invalid correlationId', requestId }, { status: 400 })
  }
  const workspaceId = typeof payload.workspaceId === 'string' && payload.workspaceId.length > 0
    ? payload.workspaceId.trim()
    : `ws-${requestId}`
  const correlationId = typeof payload.correlationId === 'string' && payload.correlationId.length > 0
    ? payload.correlationId.trim()
    : (headerCorrelationId ?? `ws-corr-${requestId}`)
  const thread = Array.isArray(payload.thread) ? (payload.thread as ThreadMessage[]) : []

  if (thread.length > MAX_THREAD_MESSAGES) {
    return Response.json({ error: `thread must have at most ${MAX_THREAD_MESSAGES} messages` }, { status: 400 })
  }

  // Same trust boundary as the turn route: no forged system messages
  // (prompt injection) and a bounded total size.
  const VALID_ROLES = ['user', 'assistant', 'tool']
  for (const m of thread) {
    if (typeof m.role !== 'string' || !VALID_ROLES.includes(m.role)) {
      return Response.json({ error: 'thread contains an invalid role' }, { status: 400 })
    }
    if (typeof m.content !== 'string') {
      return Response.json({ error: 'thread messages must be strings' }, { status: 400 })
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return Response.json({ error: `thread messages must be at most ${MAX_MESSAGE_CHARS} chars` }, { status: 400 })
    }
  }
  const totalChars = thread.reduce((n, m) => n + m.content.length, 0)
  if (totalChars > MAX_THREAD_TOTAL_CHARS) {
    return Response.json({ error: `thread must total at most ${MAX_THREAD_TOTAL_CHARS} chars` }, { status: 400 })
  }

  const stream = await createSynthesisStream(thread, { workspaceId, correlationId }, req.signal)
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
  return new Response(stream, { headers })
}
