import { NextRequest } from 'next/server'
import { createSynthesisStream } from '@/app/(main)/studio/_lib/workspace-synthesizer'
import type { ThreadMessage } from '@/app/(main)/studio/_lib/workspace-orchestrator'
import { StudioError } from '@/app/(main)/studio/_lib/errors'
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

const MAX_ID_LENGTH = 128
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const UNSAFE_ID_CHARS = /[\s*{}\[\]]/

function isBoundedId(value: string): boolean {
  const id = value.trim()
  return id.length > 0 && id.length <= MAX_ID_LENGTH && !CONTROL_CHARS.test(id) && !UNSAFE_ID_CHARS.test(id)
}

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

  if (thread.length > 200) {
    return new Response(JSON.stringify({ error: 'thread too large' }), { status: 400 })
  }

  // Same trust boundary as the turn route: no forged system messages
  // (prompt injection) and a bounded total size.
  const VALID_ROLES = ['user', 'assistant', 'tool']
  const MAX_SYNTHESIZE_MESSAGE_CHARS = 20_000
  for (const m of thread) {
    if (typeof m.role !== 'string' || !VALID_ROLES.includes(m.role)) {
      return new Response(JSON.stringify({ error: 'thread contains an invalid role' }), { status: 400 })
    }
    if (typeof m.content !== 'string') {
      return new Response(JSON.stringify({ error: 'thread messages must be strings' }), { status: 400 })
    }
    if (m.content.length > MAX_SYNTHESIZE_MESSAGE_CHARS) {
      return new Response(JSON.stringify({ error: 'thread messages must be at most 20000 chars' }), { status: 400 })
    }
  }
  const totalChars = thread.reduce((n, m) => n + m.content.length, 0)
  if (totalChars > 100_000) {
    return new Response(JSON.stringify({ error: 'thread must total at most 100000 chars' }), { status: 400 })
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
