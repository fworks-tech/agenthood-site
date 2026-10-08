// Zen protocol routing (https://opencode.ai/docs/zen/#endpoints).
//
// Zen is not one API — each model family is served on a different endpoint, and
// the agenthood `opencode` provider only speaks `/v1/chat/completions`. So a
// `/v1/messages` model (Claude family, `qwen3.8-flash`) cannot be reached
// through it and a `/v1/systemone` model (Jev) is not a text generator at all.
// This module owns the one thing the pinned dependency cannot: picking the right
// endpoint per model and speaking its protocol, so the site — not the upstream
// package — is the party that is Zen-compliant.
//
// The chat-completions path stays on the existing `agenthood` provider; only the
// messages + systemone protocols live here. Adding a model to a table below is
// the whole contract — no call-site changes.

import type { LLMResponse, LLMChunk, LLMRequest } from 'agenthood/dist/llm'

export const ZEN_BASE = 'https://opencode.ai/zen/v1'

export type ZenProtocol = 'chat' | 'messages' | 'systemone' | 'responses'

// `/v1/responses` (GPT/Grok/Muse) and `/v1/messages` (Claude + select Qwen)
// families by id prefix. Qwen is split: `qwen3.8-flash`/`qwen3.x-plus/max` are
// messages, but `qwen3.8-max` and the `*-max` under chat are not — so Qwen is
// matched by the explicit message ids, not a blanket prefix. Everything that is
// neither (DeepSeek, GLM, Kimi, MiniMax, Mistral, the `*-free` set) is chat.
const MESSAGES_EXACT = new Set(['qwen3.8-flash', 'qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-plus', 'qwen3.5-plus'])
const RESPONSES_PREFIXES = ['gpt-', 'grok-', 'muse-spark']

export function zenProtocolForModel(model: string): ZenProtocol {
  if (model.startsWith('jev-')) return 'systemone'
  if (model.startsWith('claude-') || MESSAGES_EXACT.has(model)) return 'messages'
  if (RESPONSES_PREFIXES.some((p) => model.startsWith(p))) return 'responses'
  return 'chat'
}

function messagesClient(apiKey: string) {
  return {
    'content-type': 'application/json',
    // Zen's proxy authenticates with Bearer (see the /v1/systemone + /v1/models
    // examples in the Zen docs) even though the payload is Anthropic-shaped —
    // the native x-api-key header would 401 against opencode.ai/zen.
    authorization: `Bearer ${apiKey}`,
    'anthropic-version': '2023-06-01',
  }
}

// Anthropic rejects a numeric temperature of 0 with some tools, and does not
// accept it alongside `top_p`; the demo always sends temperature only.
function toAnthropicRequest(req: LLMRequest, model: string) {
  let system: string | undefined
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = []
  for (const m of req.messages) {
    if (m.role === 'system') {
      system = system ? `${system}\n${m.content}` : m.content
      continue
    }
    if (m.role === 'tool') {
      // Anthropic matches a tool_result to the preceding tool_use block by `tool_use_id`,
      // which is the call id (m.tool_call_id) — NOT the tool name. Prefer the id; a name
      // here would make the first qwen tool result unmatched and the request is rejected.
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id ?? m.name ?? '', content: m.content }] })
      continue
    }
    const blocks: unknown[] = []
    if (m.content) blocks.push({ type: 'text', text: m.content })
    for (const tc of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: blocks })
  }
  const tools = req.tools?.length
    ? req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }))
    : undefined
  return {
    model,
    system,
    messages,
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature,
    ...(tools ? { tools } : {}),
  }
}

async function throwZenError(res: Response, provider: string): Promise<never> {
  const text = await res.text().catch(() => '')
  let detail = text
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    const inner = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message
    detail = inner ?? parsed.message ?? text
  } catch {
    /* keep raw body */
  }
  // Surface the real reason (e.g. "Insufficient account funds" on 402) rather
  // than a bare status, so a billing or protocol failure is visible to the user
  // instead of looking like an agent that is "still typing".
  throw new Error(`${provider} ${res.status}: ${detail || res.statusText}`)
}

// A minimal ILLMProvider for Zen models served on `/v1/messages`. Mirrors the
// shape `runToolLoop` and the adapters already consume from the chat provider.
// TODO: remove when agenthood@>=X.Y provides a protocol-aware OpenCodeProvider
// with messages support — then the site can import it instead of mirroring here.
export class ZenMessagesProvider {
  private model: string
  constructor(private readonly apiKey: string, model: string) {
    this.model = model
  }

  setModel(model: string): void {
    this.model = model
  }

  getContextWindow(): number {
    return 200000
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const res = await fetch(`${ZEN_BASE}/messages`, {
      method: 'POST',
      headers: messagesClient(this.apiKey),
      body: JSON.stringify(toAnthropicRequest(req, this.model)),
    })
    if (!res.ok) await throwZenError(res, 'Zen')
    const data = (await res.json()) as {
      content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[]
      usage?: { input_tokens?: number; output_tokens?: number }
      model?: string
    }
    const content = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
    const toolCalls = (data.content ?? [])
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id!, name: b.name!, args: b.input as Record<string, unknown> }))
    const promptTokens = data.usage?.input_tokens ?? 0
    const completionTokens = data.usage?.output_tokens ?? 0
    return {
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      model: data.model ?? this.model,
    }
  }

  async stream(req: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const res = await fetch(`${ZEN_BASE}/messages`, {
      method: 'POST',
      headers: { ...messagesClient(this.apiKey), accept: 'text/event-stream' },
      body: JSON.stringify({ ...toAnthropicRequest(req, this.model), stream: true }),
    })
    if (!res.ok) await throwZenError(res, 'Zen')
    const body = res.body
    if (!body) throw new Error('Zen: no response body to stream')
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    async function* generate(): AsyncGenerator<LLMChunk> {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload || payload === '[DONE]') continue
          try {
            const evt = JSON.parse(payload) as { type?: string; delta?: { type?: string; text?: string } }
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
              yield { delta: evt.delta.text, done: false }
            }
          } catch {
            /* ignore partial/keepalive frames */
          }
        }
      }
      yield { delta: '', done: true }
    }
    return generate()
  }

  async embed(): Promise<number[]> {
    throw new Error('Zen messages provider does not support embeddings')
  }
}

// Jev (System One, `/v1/systemone`) — a fast *decision* model. It does not emit
// prose; it scores typed questions against a `state` and returns values +
// probabilities. Its correct home is calibrated routing confidence, never a
// chat turn. Returns null on any failure so callers keep their deterministic
// fallback and a Jev outage can never hang a run.
export type JevQuestion =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }

export type JevAnswer = { value: string | number | boolean; probability: number }

export async function jevDecide(
  state: string,
  questions: Record<string, JevQuestion>,
  opts: { apiKey?: string; model?: string; signal?: AbortSignal } = {},
): Promise<Record<string, JevAnswer> | null> {
  const apiKey = opts.apiKey ?? process.env.OPENCODE_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`${ZEN_BASE}/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: opts.model ?? 'jev-1.13', state, questions }),
      signal: opts.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { answers?: Record<string, JevAnswer> }
    return data.answers ?? null
  } catch {
    return null
  }
}

// Single-choice decision: given a `state`, pick the best `option` and return its
// calibrated probability (0-100). Used to upgrade the routing hop that today
// gets a flat heuristic 60. Returns null on any failure so the caller keeps its
// deterministic fallback — a Jev outage can never hang or randomize a turn.
export async function jevChoice(
  state: string,
  options: string[],
  opts: { instructions?: string; apiKey?: string; signal?: AbortSignal } = {},
): Promise<{ value: string; probability: number } | null> {
  if (options.length === 0) return null
  const criteria: Record<string, string> = {}
  for (const o of options) criteria[o] = o
  const answers = await jevDecide(
    state,
    { next: { type: 'choice', instructions: opts.instructions ?? 'Which option best continues this work?', criteria } },
    { apiKey: opts.apiKey, signal: opts.signal },
  )
  const a = answers?.next
  if (!a || typeof a.value !== 'string' || !options.includes(a.value)) return null
  return { value: a.value, probability: Math.round(Math.max(0, Math.min(1, a.probability)) * 100) }
}
