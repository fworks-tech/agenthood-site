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
  buildSseHeaders,
  newWorkspaceIds,
  validateIdFields,
  validateThread,
} from '@/app/(main)/studio/_lib/workspace-core'

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
  const idError = validateIdFields({ headerCorrelationId, workspaceId: payload.workspaceId, correlationId: payload.correlationId })
  if (idError) {
    return Response.json({ error: idError, requestId }, { status: 400 })
  }
  const { workspaceId, correlationId } = newWorkspaceIds({
    workspaceId: payload.workspaceId,
    correlationId: payload.correlationId,
    headerCorrelationId,
    requestId,
  })
  const thread = Array.isArray(payload.thread) ? (payload.thread as ThreadMessage[]) : []

  const threadError = validateThread(thread)
  if (threadError) {
    return Response.json({ error: threadError }, { status: 400 })
  }

  const stream = await createSynthesisStream(thread, { workspaceId, correlationId }, req.signal)
  const headers: Record<string, string> = buildSseHeaders({ requestId, workspaceId, correlationId })
  if (didVerify) {
    headers['Set-Cookie'] = `captcha_verified=${await createCaptchaCookieValue()}; ${getCaptchaCookieAttributes()}`
  }
  return new Response(stream, { headers })
}
