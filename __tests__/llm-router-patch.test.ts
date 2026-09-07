import { describe, it, expect, beforeEach, vi } from 'vitest'

// The router reaches into LLMRouter's private static registries and the
// ProviderFailover chain's private providerNames/chainConfig to assert on
// routing order — same as the pre-existing chainConfig cast below. A single
// typed view keeps those deliberate white-box accesses honest under tsc.
interface RouterInternals {
  providerFactories: Record<string, (c?: unknown) => Promise<unknown>>
  instances: Map<unknown, unknown>
  initPromises: Map<unknown, unknown>
}
interface ChainView {
  providerNames: string[]
  chainConfig: { failureThreshold: number; cooldownMs: number }
}

describe('LLMRouter patch — preference beats priority + per-entry config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('builds chain with preferred provider first and preserves per-entry model/apiKey', async () => {
    const { LLMRouter } = await import('agenthood/dist/llm/LLMRouter.js')
    const R = LLMRouter as unknown as RouterInternals
    const captured: Record<string, unknown> = {}
    const stub = (c: unknown, key: string) => {
      captured[key] = c
      return { setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never
    }
    const orig = { ...R.providerFactories }
    R.providerFactories['opencode'] = async (c) => stub(c, 'opencode')
    R.providerFactories['groq'] = async (c) => stub(c, 'groq')
    R.providerFactories['anthropic'] = async (c) => stub(c, 'anthropic')
    R.instances.clear()
    R.initPromises.clear()

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

    const chain = (await LLMRouter.createForMember('groq', cfg as never)) as unknown as ChainView
    expect(chain.providerNames[0]).toBe('groq')
    expect(chain.providerNames).toContain('opencode')
    expect((captured['groq'] as { model: string; apiKey: string }).model).toBe('llama-3.3')
    expect((captured['groq'] as { apiKey: string }).apiKey).toBe('groq-key')
    expect((captured['opencode'] as { baseUrl: string }).baseUrl).toBe('https://oc.example')
    expect(chain.chainConfig.failureThreshold).toBe(3)

    Object.assign(R.providerFactories, orig)
  })

  it('synthesizes preferred provider when absent from config', async () => {
    const { LLMRouter } = await import('agenthood/dist/llm/LLMRouter.js')
    const R = LLMRouter as unknown as RouterInternals
    const okStub = () => ({ setModel() {}, getContextWindow() { return 8192 }, complete: async () => ({ content: 'ok' }), stream: async function* () {} } as unknown as never)
    const orig = { ...R.providerFactories }
    R.providerFactories['opencode-go'] = async () => okStub()
    R.providerFactories['opencode'] = async () => okStub()
    R.providerFactories['anthropic'] = async () => okStub()
    R.instances.clear()
    R.initPromises.clear()

    const cfg = {
      providers: [
        { name: 'opencode-go', priority: 1 },
        { name: 'opencode', priority: 2 },
      ],
    }
    const chain = (await LLMRouter.createForMember('anthropic', cfg as never)) as unknown as ChainView
    expect(chain.providerNames[0]).toBe('anthropic')
    expect(chain.providerNames).toEqual(expect.arrayContaining(['opencode-go', 'opencode']))

    Object.assign(R.providerFactories, orig)
  })
})
