import type { ToolSchema } from "agenthood/dist/llm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCustomToolSchemas } from "./custom-tools";

export interface ToolDefinition {
  schema: ToolSchema;
  execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<string>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
}

export const MAX_TOOL_ITERATIONS = 25;
// Playground and workspace turns share a 60s Vercel budget with the LLM
// calls, and every tool result is re-sent on each loop iteration — keep
// budgeted loops short and results small so tool-heavy runs finish in time.
export const PLAYGROUND_MAX_TOOL_ITERATIONS = 10;
export const TOOL_RESULT_MAX_CHARS = 6_000;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_FETCH_REDIRECTS = 5
export const CODE_EXECUTION_MAX_CHARS = 4_000
const CODE_RESULT_MAX_VALUE_CHARS = 200
const CODE_RESULT_MAX_ITEMS = 100

const ALLOWED_FETCH_HOSTS = [
  "github.com",
  "raw.githubusercontent.com",
  "gist.github.com",
];

function isAllowedFetchUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return ALLOWED_FETCH_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith("." + h),
    );
  } catch {
    return false;
  }
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}

async function readBoundedText(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  try {
    while (out.length < TOOL_RESULT_MAX_CHARS) {
      const { done, value } = await reader.read()
      if (done) break
      out += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return out.slice(0, TOOL_RESULT_MAX_CHARS)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TOOL_RESULT_MAX_CHARS);
}

async function webFetchHandler(
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const url = args.url as string
  if (!url) return 'Error: url is required'

  const notAllowed = `Error: URL not allowed. Allowed hosts: ${ALLOWED_FETCH_HOSTS.join(', ')}`
  if (!isAllowedFetchUrl(url)) return notAllowed

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => ctrl.abort())

  const headers = { 'User-Agent': 'Agenthood/1.0' }
  const doFetch = (target: string) => fetch(target, { signal: ctrl.signal, headers, redirect: 'manual' })

  try {
    let currentUrl = url
    let res = await doFetch(currentUrl)

    // fetch() would follow redirects internally and hand back a body from a
    // host the initial allow-list check never saw, so each hop is checked.
    for (let i = 0; i < MAX_FETCH_REDIRECTS && isRedirect(res.status); i++) {
      const location = res.headers.get('location')
      if (!location) return `Error: HTTP ${res.status} ${res.statusText}`
      let nextUrl: string
      try {
        nextUrl = new URL(location, currentUrl).toString()
      } catch {
        return 'Error: invalid redirect URL'
      }
      if (!isAllowedFetchUrl(nextUrl)) return notAllowed
      try { await res.body?.cancel() } catch { /* drop the error body */ }
      currentUrl = nextUrl
      res = await doFetch(currentUrl)
    }
    if (isRedirect(res.status)) return 'Error: too many redirects'

    // Single retry on 5xx: hosts (notably GitHub) intermittently 503
    // datacenter egress. 4xx is the caller's mistake — no retry.
    if (res.status >= 500 && res.status < 600) {
      try { await res.body?.cancel() } catch { /* drop the error body */ }
      await new Promise((r) => setTimeout(r, 500))
      res = await doFetch(currentUrl)
    }
    if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`
    if (res.url && !isAllowedFetchUrl(res.url)) return notAllowed

    const contentType = res.headers.get('content-type') ?? ''
    const text = await readBoundedText(res.body)

    if (contentType.includes('text/html')) return stripHtml(text)
    return text
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    clearTimeout(timer)
  }
}

function serializeBoundedResult(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, TOOL_RESULT_MAX_CHARS)
  const seen = new WeakSet<object>()
  const replacer = (_key: string, v: unknown): unknown => {
    if (typeof v === 'string' && v.length > CODE_RESULT_MAX_VALUE_CHARS) {
      return v.slice(0, CODE_RESULT_MAX_VALUE_CHARS)
    }
    if (Array.isArray(v) && v.length > CODE_RESULT_MAX_ITEMS) return v.slice(0, CODE_RESULT_MAX_ITEMS)
    if (v && typeof v === 'object') {
      if (seen.has(v)) return '[circular]'
      seen.add(v)
      if (!Array.isArray(v)) {
        const trimmed: Record<string, unknown> = {}
        let count = 0
        for (const key in v) {
          if (count >= CODE_RESULT_MAX_ITEMS) return trimmed
          trimmed[key] = (v as Record<string, unknown>)[key]
          count += 1
        }
      }
    }
    return v
  }
  return JSON.stringify(value, replacer, 2).slice(0, TOOL_RESULT_MAX_CHARS)
}

async function codeExecutionHandler(
  args: Record<string, unknown>,
): Promise<string> {
  const code = args.code as string
  if (!code || typeof code !== 'string') return 'Error: code is required'
  if (code.length > CODE_EXECUTION_MAX_CHARS) {
    return `Error: code exceeds ${CODE_EXECUTION_MAX_CHARS} characters`
  }

  // shortcut: the VM timeout cannot bound native allocations, so a tiny
  // script can still exhaust the function heap; move to a worker with
  // resourceLimits if that becomes exploitable in practice.
  const vm = await import("node:vm");
  // Hardening is load-bearing, not decoration. A bare createContext({}) hands
  // user code the HOST realm's prototype chain, so this.constructor.constructor
  // reaches the real `process` and exfiltrates every secret in process.env
  // (OPENCODE_API_KEY, Sentry DSN, Turnstile secret, Upstash token) through
  // the tool result. Two settings close it together:
  //   - a null-prototype sandbox, so there is no host prototype to walk
  //   - codeGeneration off, so eval/Function/WebAssembly are refused
  // Verified against 14 escape vectors; all blocked, ordinary JS unaffected.
  // Still not a true sandbox: it isolates the realm, not the OS.
  const context = vm.createContext(Object.create(null) as Record<string, unknown>, {
    codeGeneration: { strings: false, wasm: false },
  });

  try {
    const script = new vm.Script(code, { filename: "user-code.js" });
    const result = script.runInContext(context, { timeout: 5000 })
    if (result === undefined) return "Executed successfully (undefined result)"
    // Same cap as web_fetch: large outputs are re-sent on every loop
    // iteration, so an unsliced dump would blow the context budget.
    return serializeBoundedResult(result)
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// Packaged agenthood skill documents. The prompt advertises these names to
// every member; before this tool existed "activate by name" was a lie, because
// no member could call anything. Name and shape match upstream's
// ActivateSkillTool so a future swap is compatible. Upstream's class needs an
// ExecutionContext the Studio does not build, so read the shipped markdown.
const SKILLS_DIR = join(process.cwd(), "node_modules", "agenthood", "skills");
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,56}$/;

async function activateSkillHandler(
  args: Record<string, unknown>,
): Promise<string> {
  const name = args.skill_name;
  if (typeof name !== "string" || !SKILL_NAME_PATTERN.test(name)) {
    return "Error: skill_name must be a lowercase skill name";
  }
  // The pattern admits no separator, so the join cannot escape SKILLS_DIR.
  let doc: string;
  try {
    doc = await readFile(join(SKILLS_DIR, name, "SKILL.md"), "utf8");
  } catch {
    return `Error: skill "${name}" not found`;
  }
  return doc.slice(0, TOOL_RESULT_MAX_CHARS);
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  web_fetch: {
    schema: {
      name: "web_fetch",
      description:
        "Fetch the content of a URL and return the text. Allowed hosts: github.com, raw.githubusercontent.com, gist.github.com. Returns the page content as text (HTML stripped).",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch (must be an allowed host)",
          },
        },
        required: ["url"],
      },
    },
    execute: webFetchHandler,
  },
  code_execution: {
    schema: {
      name: "code_execution",
      description:
        "Execute JavaScript in an isolated Node.js VM context. The code cannot reach the host process, filesystem, network, or eval/Function. Standard JS built-ins only (Math, Date, JSON, Map, Set). Returns the result as a string. Timeout: 5 seconds.",
      inputSchema: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The JavaScript code to execute",
          },
        },
        required: ["code"],
      },
    },
    execute: codeExecutionHandler,
  },
  activate_skill: {
    schema: {
      name: "activate_skill",
      description:
        "Load the full operating manual for one of the Society's skills by name. Call this when a task matches a skill named in your available skills list.",
      inputSchema: {
        type: "object",
        properties: {
          skill_name: {
            type: "string",
            description: "Name of the skill to load, e.g. commit-messages",
          },
        },
        required: ["skill_name"],
      },
    },
    execute: activateSkillHandler,
  },
};

export function getToolSchemas(): ToolSchema[] {
  return [...Object.values(TOOL_DEFINITIONS).map((t) => t.schema), ...getCustomToolSchemas()];
}

// Single source of truth for which tool names are real; the two public routes
// filter against this instead of hand-typing the list.
export const BUILT_IN_TOOL_NAMES: ReadonlySet<string> = new Set(Object.keys(TOOL_DEFINITIONS));

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const tool = TOOL_DEFINITIONS[name];
  if (tool) return tool.execute(args, signal);
  if (name.startsWith("custom_")) return `Error: custom tool "${name}" execution not yet implemented`;
  return `Error: unknown tool "${name}"`;
}

/**
 * Tool handlers encode failures as `Error: …` strings in the result, so the
 * transport can split them into a structured `error` field. This keeps the
 * emitted `tool_result.error` truthful (and enables "replay" targeting) while
 * the LLM-visible `role: "tool"` content stays unchanged.
 */
export function classifyToolResult(result: string): { result?: string; error?: string } {
  if (/^Error: /.test(result)) {
    return { error: result };
  }
  return { result };
}
