import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  zenProtocolForModel,
  ZenMessagesProvider,
  jevChoice,
} from '../app/(main)/studio/_lib/zen'

function jsonFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('zenProtocolForModel', () => {
  it('routes qwen3.8-flash and Claude to /v1/messages', () => {
    expect(zenProtocolForModel('qwen3.8-flash')).toBe('messages')
    expect(zenProtocolForModel('claude-sonnet-5')).toBe('messages')
  })
  it('routes jev to systemone', () => {
    expect(zenProtocolForModel('jev-1.13')).toBe('systemone')
  })
  it('routes gpt/grok/muse to responses', () => {
    expect(zenProtocolForModel('gpt-6-sol')).toBe('responses')
    expect(zenProtocolForModel('grok-4.7')).toBe('responses')
  })
  it('defaults the rest to chat/completions', () => {
    for (const m of ['deepseek-v4-flash', 'glm-5.3-flash', 'kimi-k2.5', 'mimo-v2.6-flash-free', 'qwen3.8-max']) {
      expect(zenProtocolForModel(m)).toBe('chat')
    }
  })
})

describe('ZenMessagesProvider.complete', () => {
  it('maps text and tool_use blocks into the chat-completions shape', async () => {
    const fetchMock = jsonFetch({
      content: [
        { type: 'text', text: 'let me ' },
        { type: 'tool_use', id: 't1', name: 'web_fetch', input: { url: 'x' } },
      ],
      usage: { input_tokens: 10, output_tokens: 4 },
      model: 'qwen3.8-flash',
    })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new ZenMessagesProvider('key', 'qwen3.8-flash')
    const res = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] })
    expect(res.content).toBe('let me ')
    expect(res.toolCalls).toEqual([{ id: 't1', name: 'web_fetch', args: { url: 'x' } }])
    expect(res.usage).toMatchObject({ promptTokens: 10, completionTokens: 4, totalTokens: 14 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://opencode.ai/zen/v1/messages')
    // /v1/messages is Anthropic-compatible -> x-api-key (Bearer would 401 "Missing API key")
    expect(init.headers).toMatchObject({ 'x-api-key': 'key', 'anthropic-version': '2023-06-01' })
    expect(init.headers).not.toHaveProperty('authorization')
    expect(JSON.parse(init.body).system).toBeUndefined()
  })

  it('hoists a system message out of the turns', async () => {
    const fetchMock = jsonFetch({ content: [{ type: 'text', text: 'ok' }], usage: {} })
    vi.stubGlobal('fetch', fetchMock)
    const provider = new ZenMessagesProvider('key', 'claude-sonnet-5')
    await provider.complete({ messages: [{ role: 'system', content: 'be terse' }, { role: 'user', content: 'hi' }] })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).system).toBe('be terse')
  })

  it('surfaces the real error message (e.g. insufficient funds)', async () => {
    vi.stubGlobal('fetch', jsonFetch({ error: { message: 'Insufficient account funds' } }, false, 402))
    const provider = new ZenMessagesProvider('key', 'qwen3.8-flash')
    await expect(provider.complete({ messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow(/402.*Insufficient account funds/)
  })
})

describe('jevChoice', () => {
  it('returns the chosen value with a 0-100 probability', async () => {
    vi.stubGlobal('fetch', jsonFetch({ answers: { next: { value: 'the-builder', probability: 0.82 } } }))
    const r = await jevChoice('state', ['the-builder', 'the-tester'], { apiKey: 'k' })
    expect(r).toEqual({ value: 'the-builder', probability: 82 })
  })
  it('rejects an out-of-catalog choice so the caller keeps its fallback', async () => {
    vi.stubGlobal('fetch', jsonFetch({ answers: { next: { value: 'ghost', probability: 0.9 } } }))
    expect(await jevChoice('state', ['the-builder'], { apiKey: 'k' })).toBeNull()
  })
  it('is null without an API key (never blocks a turn)', async () => {
    delete process.env.OPENCODE_API_KEY
    expect(await jevChoice('state', ['the-builder'])).toBeNull()
  })
  it('is null when the endpoint errors', async () => {
    vi.stubGlobal('fetch', jsonFetch({}, false, 402))
    expect(await jevChoice('state', ['the-builder'], { apiKey: 'k' })).toBeNull()
  })
})
