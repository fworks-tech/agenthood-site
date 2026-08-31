import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('LLMRouter patch — preference beats priority + per-entry config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('builds chain with preferred provider first and preserves per-entry model/apiKey', async () => {
    const { LLMRouter } = await import('agenthood/dist/llm/LLMRouter.js')
    const captured: Record<string, unknown> = {}
    const orig = { ...LLMRouter.providerFactories }
    LLMRouter.providerFactories['opencode'] = async (c: unknown) => {
      captured['opencode'] = c
      return { setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never
    }
    LLMRouter.providerFactories['groq'] = async (c: unknown) => {
      captured['groq'] = c
      return { setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never
    }
    LLMRouter.providerFactories['anthropic'] = async (c: unknown) => {
      captured['anthropic'] = c
      return { setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never
    }
    LLMRouter.instances.clear()
    LLMRouter.initPromises.clear()

    const cfg = {
      providers: [
        { name: 'groq', priority: 4, model: 'llama-3.3', apiKey: 'groq-key' },
        { name: 'opencode', priority: 2, model: 'deepseek-v4-flash', apiKey: 'oc-key', baseUrl: 'https://oc.example' },
        { name: 'opencode-go', priority: 1, model: 'deepseek-v4-flash' },
        { name: 'anthropic', priority: 3 },
      ],
      failureThreshold: 3,
      cooldownMs: 60000,
      probeEnabled: true,
    }

    const chain = await LLMRouter.createForMember('groq', cfg as never)
    expect(chain.providerNames[0]).toBe('groq')
    expect(chain.providerNames).toContain('opencode')
    expect((captured['groq'] as { model: string; apiKey: string }).model).toBe('llama-3.3')
    expect((captured['groq'] as { apiKey: string }).apiKey).toBe('groq-key')
    expect((captured['opencode'] as { baseUrl: string }).baseUrl).toBe('https://oc.example')
    expect((chain as unknown as { chainConfig: { failureThreshold: number; cooldownMs: number } }).chainConfig.failureThreshold).toBe(3)

    Object.assign(LLMRouter.providerFactories, orig)
  })

  it('synthesizes preferred provider when absent from config', async () => {
    const { LLMRouter } = await import('agenthood/dist/llm/LLMRouter.js')
    const orig = { ...LLMRouter.providerFactories }
    LLMRouter.providerFactories['opencode-go'] = async () => ({ setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never)
    LLMRouter.providerFactories['opencode'] = async () => ({ setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never)
    LLMRouter.providerFactories['anthropic'] = async () => ({ setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never)
    LLMRouter.instances.clear()
    LLMRouter.initPromises.clear()

    const cfg = {
      providers: [
        { name: 'opencode-go', priority: 1 },
        { name: 'opencode', priority: 2 },
      ],
    }
    const chain = await LLMRouter.createForMember('anthropic', cfg as never)
    expect(chain.providerNames[0]).toBe('anthropic')
    expect(chain.providerNames).toEqual(expect.arrayContaining(['opencode-go', 'opencode']))

    Object.assign(LLMRouter.providerFactories, orig)
  })
})
