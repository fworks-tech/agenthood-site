import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '../app/api/studio/jev/route'

function req(body: unknown, token = 'sekret') {
  return new Request('http://localhost/api/studio/jev', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jev-token': token },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.JEV_ROUTING_ENABLED = 'true'
  process.env.JEV_INTERNAL_TOKEN = 'sekret'
  process.env.OPENCODE_API_KEY = 'k'
})
afterEach(() => {
  delete process.env.JEV_ROUTING_ENABLED
  delete process.env.JEV_INTERNAL_TOKEN
  delete process.env.OPENCODE_API_KEY
  vi.unstubAllGlobals()
})

test('POST /api/studio/jev is disabled (204) unless JEV_ROUTING_ENABLED', async () => {
  delete process.env.JEV_ROUTING_ENABLED
  const res = await POST(req({ state: 's', options: ['a'] }))
  expect(res.status).toBe(204)
})

test('POST /api/studio/jev refuses when enabled but no internal secret is configured', async () => {
  delete process.env.JEV_INTERNAL_TOKEN
  const res = await POST(req({ state: 's', options: ['a'] }, ''))
  expect(res.status).toBe(204)
})

test('POST /api/studio/jev rejects a request without the internal secret', async () => {
  const res = await POST(req({ state: 'thread', options: ['a'] }, 'wrong'))
  expect(res.status).toBe(401)
})

test('POST /api/studio/jev validates the body', async () => {
  expect((await POST(req({ options: ['a'] }))).status).toBe(400)
  expect((await POST(req({ state: 's', options: [] }))).status).toBe(400)
})

test('POST /api/studio/jev returns the calibrated choice', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ answers: { next: { value: 'the-builder', probability: 0.9 } } }),
  }))
  const res = await POST(req({ state: 'thread tail', options: ['the-builder', 'the-tester'] }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ value: 'the-builder', probability: 90 })
})

test('POST /api/studio/jev falls back to unavailable when Jev errors — never a hard failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) }))
  const res = await POST(req({ state: 'x', options: ['a'] }))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ unavailable: true })
})
