import { parseCaptchaCookie, validateTurnstile } from '@/app/_lib/studio-server/captcha'
import { POST as jevPost } from '@/app/api/studio/jev/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

// The chain engine runs in the browser and must never hold JEV_INTERNAL_TOKEN.
// This bridge gates the paid hop behind a solved Studio CAPTCHA, then attaches
// the secret server-side and delegates to the one Jev proxy implementation.
export async function POST(request: Request) {
  const secret = process.env.JEV_INTERNAL_TOKEN
  if (process.env.JEV_ROUTING_ENABLED !== 'true' || !secret) {
    return Response.json({ unavailable: true })
  }

  try {
    await validateTurnstile(undefined, parseCaptchaCookie(request.headers.get('cookie')))
  } catch {
    return Response.json({ unavailable: true }, { status: 403 })
  }

  const headers = new Headers(request.headers)
  headers.set('x-jev-token', secret)
  return jevPost(new Request(request.url, {
    method: 'POST',
    headers,
    body: await request.text(),
    signal: request.signal,
  }))
}
