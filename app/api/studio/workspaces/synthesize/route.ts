import { NextRequest } from 'next/server'
import { createSynthesisStream } from '@/app/(main)/studio/_lib/workspace-synthesizer'
import type { ThreadMessage } from '@/app/(main)/studio/_lib/workspace-orchestrator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const payload = body as { workspaceId?: unknown; correlationId?: unknown; thread?: unknown }
  const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : `ws-${Date.now()}`
  const correlationId = typeof payload.correlationId === 'string' ? payload.correlationId : req.headers.get('x-correlation-id') ?? `ws-corr-${Date.now()}`
  const thread = Array.isArray(payload.thread) ? (payload.thread as ThreadMessage[]) : []

  if (thread.length > 200) {
    return new Response(JSON.stringify({ error: 'thread too large' }), { status: 400 })
  }

  const stream = await createSynthesisStream(thread, { workspaceId, correlationId }, req.signal)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'x-correlation-id': correlationId,
      'x-workspace-id': workspaceId,
    },
  })
}
