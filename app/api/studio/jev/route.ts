import { logger } from '@/app/(main)/studio/_lib/logger'
import { jevChoice } from '@/app/(main)/studio/_lib/zen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const MAX_OPTIONS = 32
const MAX_STATE_CHARS = 4000

// Server-side only: keeps OPENCODE_API_KEY off the client. Disabled unless the
// operator opts in — the routing hop then falls back to the deterministic 60. When
// enabled this is a paid-provider proxy, so it also requires the internal shared
// secret (JEV_INTERNAL_TOKEN) that the engine attaches — no public abuse surface.
export async function POST(request: Request) {
  if (process.env.JEV_ROUTING_ENABLED !== 'true') {
    return new Response(null, { status: 204 })
  }

  const secret = process.env.JEV_INTERNAL_TOKEN
  if (!secret) {
    // Enabled but not configured with a secret: refuse rather than expose a paid proxy.
    logger.error('jev.misconfigured', { reason: 'JEV_ROUTING_ENABLED without JEV_INTERNAL_TOKEN' })
    return new Response(null, { status: 204 })
  }
  if (request.headers.get('x-jev-token') !== secret) {
    return new Response(null, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { state, options, instructions } = (body ?? {}) as {
    state?: unknown
    options?: unknown
    instructions?: unknown
  }
  if (typeof state !== 'string' || state.trim().length === 0) {
    return Response.json({ error: 'state is required' }, { status: 400 })
  }
  if (!Array.isArray(options) || options.length === 0 || options.length > MAX_OPTIONS) {
    return Response.json({ error: `options must be 1-${MAX_OPTIONS} items` }, { status: 400 })
  }
  if (!options.every((o) => typeof o === 'string' && o.length > 0 && o.length <= 120)) {
    return Response.json({ error: 'options must be short strings' }, { status: 400 })
  }

  const result = await jevChoice(state.slice(0, MAX_STATE_CHARS), options as string[], {
    instructions: typeof instructions === 'string' ? instructions.slice(0, 500) : undefined,
    signal: AbortSignal.timeout(12_000),
  })

  if (!result) {
    logger.info('jev.unavailable', { options: options.length })
    return Response.json({ unavailable: true }, { status: 200 })
  }
  logger.info('jev.routed', { value: result.value, probability: result.probability })
  return Response.json(result, { status: 200 })
}
