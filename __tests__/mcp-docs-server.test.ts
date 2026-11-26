import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const originalEnv = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
  delete process.env.MCP_DOCS_URL
  delete process.env.MCP_DOCS_AUTH_TOKEN
})

afterEach(() => {
  process.env = originalEnv
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('mcp docs server closed by default', () => {
  it('resolves no servers without MCP_DOCS_URL', async () => {
    const { resolveMcpServers, isMcpToolConfigured } = await import('@/app/_lib/studio-server/tools')
    expect(resolveMcpServers()).toEqual({})
    expect(isMcpToolConfigured('mcp__docs__search')).toBe(false)
  })

  it('skips the server when the auth token is missing', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    const { resolveMcpServers, isMcpToolAllowedForMember } = await import('@/app/_lib/studio-server/tools')
    expect(resolveMcpServers()).toEqual({})
    expect(isMcpToolAllowedForMember('the-builder', 'mcp__docs__search')).toBe(false)
  })

  it('rejects malformed names', async () => {
    const { parseMcpToolName } = await import('@/app/_lib/studio-server/tools')
    expect(parseMcpToolName('mcp__docs__')).toBeNull()
    expect(parseMcpToolName('mcp__DOCS__search')).toBeNull()
    expect(parseMcpToolName('web_fetch')).toBeNull()
    expect(parseMcpToolName(42)).toBeNull()
    expect(parseMcpToolName('mcp__docs__search')).toEqual({ server: 'docs', tool: 'search' })
  })

  it('denies unknown members even when configured', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    process.env.MCP_DOCS_AUTH_TOKEN = 'secret'
    const { isMcpToolAllowedForMember } = await import('@/app/_lib/studio-server/tools')
    expect(isMcpToolAllowedForMember('the-builder', 'mcp__docs__search')).toBe(true)
    expect(isMcpToolAllowedForMember('nobody', 'mcp__docs__search')).toBe(false)
    expect(isMcpToolAllowedForMember('the-builder', 'mcp__evil__x')).toBe(false)
  })
})

describe('mcp docs server execution', () => {
  it('returns tool text on success', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    process.env.MCP_DOCS_AUTH_TOKEN = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: 'hello docs' }] } }),
    ))
    const { executeTool } = await import('@/app/_lib/studio-server/tools')
    expect(await executeTool('mcp__docs__search', { q: 'x' })).toBe('hello docs')
  })

  it('sends bearer auth and tools/call payload', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    process.env.MCP_DOCS_AUTH_TOKEN = 'secret'
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', result: { content: [] } }))
    vi.stubGlobal('fetch', fetchSpy)
    const { executeTool } = await import('@/app/_lib/studio-server/tools')
    await executeTool('mcp__docs__search', { q: 'x' })
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://docs.example.com/mcp')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret')
    expect((init as { redirect?: string }).redirect).toBe('error')
    expect(JSON.parse(init.body as string).method).toBe('tools/call')
  })

  it('maps server errors to Error: strings', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    process.env.MCP_DOCS_AUTH_TOKEN = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ jsonrpc: '2.0', error: { message: 'nope' } }),
    ))
    const { executeTool } = await import('@/app/_lib/studio-server/tools')
    expect(await executeTool('mcp__docs__search', {})).toContain('Error: MCP search failed')
  })

  it('maps HTTP failures and non-JSON to Error: strings', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    process.env.MCP_DOCS_AUTH_TOKEN = 'secret'
    const { executeTool } = await import('@/app/_lib/studio-server/tools')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 500 })))
    expect(await executeTool('mcp__docs__search', {})).toContain('Error: MCP search HTTP 500')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
    expect(await executeTool('mcp__docs__search', {})).toContain('non-JSON')
  })

  it('lists only requested schemas', async () => {
    process.env.MCP_DOCS_URL = 'https://docs.example.com/mcp'
    process.env.MCP_DOCS_AUTH_TOKEN = 'secret'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      jsonrpc: '2.0',
      result: { tools: [
        { name: 'search', description: 's', inputSchema: { type: 'object' } },
        { name: 'fetch', description: 'f', inputSchema: { type: 'object' } },
      ] },
    })))
    const { getMcpToolSchemas } = await import('@/app/_lib/studio-server/tools')
    const schemas = await getMcpToolSchemas(['mcp__docs__search'])
    expect(schemas.map((s) => s.name)).toEqual(['mcp__docs__search'])
  })
})
