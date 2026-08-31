// #TODO Workspaces: POST /api/studio/workspaces per docs/hackathon/spec.md:164-186
// - validate { memberIds: string[] (non-empty, getAgentById whitelist), instruction: string (required, max 4000) }
// - no Turnstile (TURNSTILE_ENABLED=false parity), own RATE_LIMITS entry in app/middleware.ts:31
// - server defaults: opencode-go, getDefaultModel('opencode-go'), 0.7, 4096, web_fetch+code_execution
// - emits NDJSON SSE (workspace.* vocabulary) via new Response(stream) with runtime=nodejs, dynamic=force-dynamic, maxDuration=60 per turn

import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_req: NextRequest) {
  // #TODO implement
  void _req
  return new Response('Not implemented', { status: 501 })
}
