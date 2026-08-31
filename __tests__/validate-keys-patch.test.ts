import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('validateApiKeys patch — primary-throw fallback-warn + per-entry scope', () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    delete process.env.GROQ_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENCODE_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    process.env = { ...origEnv }
    vi.restoreAllMocks()
  })

  it('throws when top-priority provider key is missing', async () => {
    const { validateApiKeys } = await import('agenthood/dist/llm/validateApiKeys.js')
    const cfg = {
      providers: [
        { name: 'opencode-go', priority: 1 },
        { name: 'groq', priority: 4 },
      ],
    }
    expect(() => validateApiKeys(cfg as never)).toThrow(/OPENCODE_API_KEY/)
  })

  it('warns for missing fallback but does not throw', async () => {
    const { validateApiKeys } = await import('agenthood/dist/llm/validateApiKeys.js')
    process.env.OPENCODE_API_KEY = 'oc-x'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cfg = {
      providers: [
        { name: 'opencode-go', priority: 1 },
        { name: 'groq', priority: 4 },
      ],
    }
    expect(() => validateApiKeys(cfg as never)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('GROQ_API_KEY'))
  })

  it('does not count global apiKey when providers array is present', async () => {
    const { validateApiKeys } = await import('agenthood/dist/llm/validateApiKeys.js')
    const cfg = {
      apiKey: 'global-key',
      providers: [
        { name: 'opencode-go', priority: 1 },
        { name: 'groq', priority: 4 },
      ],
    }
    expect(() => validateApiKeys(cfg as never)).toThrow(/OPENCODE_API_KEY/)
  })

  it('allows global apiKey when no providers array', async () => {
    const { validateApiKeys } = await import('agenthood/dist/llm/validateApiKeys.js')
    const cfg = { apiKey: 'global-key', provider: 'groq' }
    expect(() => validateApiKeys(cfg as never)).not.toThrow()
  })
})
