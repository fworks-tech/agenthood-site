import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL = 'https://opencode.ai/compat/v1/chat/completions'
const OTHER = 'https://api.example.com/v1/chat'

let calls: Array<{ url: string; headers: Headers }> = []
let realFetch: typeof globalThis.fetch

async function freshPatch() {
  vi.resetModules()
  const mod = await import('@/app/(main)/studio/_lib/opencode-session')
  mod.patchOpenCodeSession()
}

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) })
    return Promise.resolve(new Response('ok'))
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.resetModules()
  delete process.env.OPENCODE_SESSION_ID
})

describe('patchOpenCodeSession', () => {
  it('adds x-opencode-session to opencode.ai requests', async () => {
    await freshPatch()
    await globalThis.fetch(ORIGINAL)
    expect(calls[0].headers.get('x-opencode-session')).toBeTruthy()
  })

  it('keeps the session id stable across requests (cache affinity)', async () => {
    await freshPatch()
    await globalThis.fetch(ORIGINAL)
    await globalThis.fetch(ORIGINAL)
    expect(calls[0].headers.get('x-opencode-session')).toBe(
      calls[1].headers.get('x-opencode-session'),
    )
  })

  it('honours OPENCODE_SESSION_ID override', async () => {
    process.env.OPENCODE_SESSION_ID = 'conv-42'
    await freshPatch()
    await globalThis.fetch(ORIGINAL)
    expect(calls[0].headers.get('x-opencode-session')).toBe('conv-42')
  })

  it('does not touch non-opencode hosts', async () => {
    await freshPatch()
    await globalThis.fetch(OTHER)
    expect(calls[0].headers.get('x-opencode-session')).toBeNull()
  })

  it('preserves an existing session header', async () => {
    await freshPatch()
    await globalThis.fetch(ORIGINAL, { headers: { 'x-opencode-session': 'mine' } })
    expect(calls[0].headers.get('x-opencode-session')).toBe('mine')
  })

  it('is idempotent — double patch does not stack wrappers', async () => {
    const { patchOpenCodeSession } = await import('@/app/(main)/studio/_lib/opencode-session')
    patchOpenCodeSession()
    patchOpenCodeSession()
    await globalThis.fetch(ORIGINAL)
    expect(calls).toHaveLength(1)
  })
})
