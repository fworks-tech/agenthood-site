import type { ToolSchema } from "agenthood/dist/llm";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getCustomToolSchemas } from "@/app/(main)/studio/_lib/custom-tools";
import { getAgentById } from "@/app/(main)/studio/_data/agents";
import { logger } from "./logger";

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

// The worker owns the memory limit: the vm timeout alone cannot stop a native
// allocation, and a eval'd worker must never receive user code as its source.
const WORKER_SOURCE = `
const vm = require('node:vm')
const { parentPort, workerData } = require('node:worker_threads')
try {
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } })
  const result = new vm.Script(workerData.code, { filename: 'user-code.js' }).runInContext(context, { timeout: workerData.timeout })
  if (result === undefined) {
    parentPort.postMessage({ ok: true, text: 'Executed successfully (undefined result)' })
  } else {
    const seen = new WeakSet()
    const replacer = (_key, value) => {
      if (typeof value === 'string' && value.length > workerData.valueChars) return value.slice(0, workerData.valueChars)
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[circular]'
        seen.add(value)
        if (Array.isArray(value)) return value.slice(0, workerData.maxItems)
        const trimmed = {}
        let count = 0
        for (const key in value) {
          if (count >= workerData.maxItems) break
          trimmed[key] = value[key]
          count += 1
        }
        return trimmed
      }
      return value
    }
    const text = typeof result === 'string'
      ? result.slice(0, workerData.maxChars)
      : JSON.stringify(result, replacer, 2).slice(0, workerData.maxChars)
    parentPort.postMessage({ ok: true, text })
  }
} catch (err) {
  parentPort.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
}
`

// A fatal V8 out-of-memory abort can take down the whole process even with
// worker resourceLimits, so the worker runs inside a child with its own heap.
const CHILD_SOURCE = `
const { Worker } = require('node:worker_threads')
const workerSource = ${JSON.stringify(WORKER_SOURCE)}
let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
  try {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: JSON.parse(input),
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, codeRangeSizeMb: 8, stackSizeMb: 2 },
      timeout: 5000,
    })
    worker.on('message', (message) => { process.stdout.write(JSON.stringify(message)); process.exit(0) })
    worker.on('error', (err) => { process.stdout.write(JSON.stringify({ ok: false, error: err.message })); process.exit(0) })
    worker.on('exit', () => { process.stdout.write(JSON.stringify({ ok: false, error: 'worker exited' })); process.exit(0) })
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }))
    process.exit(0)
  }
})
`

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

function runCodeInWorker(code: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--max-old-space-size=64', '-e', CHILD_SOURCE], {
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    let output = ''
    let settled = false
    const finish = (text: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(text)
    }
    const timer = setTimeout(() => finish('Error: code execution timed out'), 8000)

    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.on('close', (exitCode) => {
      try {
        const message = JSON.parse(output) as { ok: boolean; text?: string; error?: string }
        finish(message.ok ? (message.text ?? '') : `Error: ${message.error ?? 'unknown error'}`)
      } catch {
        finish(`Error: code execution failed (exit ${exitCode})`)
      }
    })
    child.on('error', (err) => finish(`Error: ${err.message}`))

    child.stdin.end(JSON.stringify({
      code,
      timeout: 5000,
      maxChars: TOOL_RESULT_MAX_CHARS,
      valueChars: CODE_RESULT_MAX_VALUE_CHARS,
      maxItems: CODE_RESULT_MAX_ITEMS,
    }))
  })
}

async function codeExecutionHandler(
  args: Record<string, unknown>,
): Promise<string> {
  const code = args.code as string
  if (!code || typeof code !== 'string') return 'Error: code is required'
  if (code.length > CODE_EXECUTION_MAX_CHARS) {
    return `Error: code exceeds ${CODE_EXECUTION_MAX_CHARS} characters`
  }

  // The null-prototype context and disabled code generation keep the worker's
  // realm isolated from the host; resourceLimits bound native allocations the
  // vm timeout cannot stop. Still a realm sandbox, not an OS sandbox.
  return runCodeInWorker(code)
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

// MCP (Agenthood 4.5): remote HTTP servers only on Vercel. stdio spawns cannot
// run in serverless (read-only /var/task, no child_process) and must fail
// closed. Tool names are namespaced mcp__<server>__<tool> after the
// declared ∩ allowlist ∩ profile grant. Servers are host-declared in
// .agenthood/config.json `mcpServers`; an unconfigured server fails closed.
export const MCP_TOOL_PREFIX = "mcp__";

const MCP_TOOL_PATTERN = /^mcp__([a-z0-9-]+)__([A-Za-z0-9_-]{1,64})$/;

export function isMcpToolName(name: unknown): boolean {
  return typeof name === "string" && name.startsWith(MCP_TOOL_PREFIX);
}

export function parseMcpToolName(name: unknown): { server: string; tool: string } | null {
  if (typeof name !== "string") return null;
  const m = MCP_TOOL_PATTERN.exec(name);
  return m ? { server: m[1], tool: m[2] } : null;
}

interface McpServerConfig {
  url: string;
  headers: Record<string, string>;
}

// Expand every ${env:VAR} ref; a missing var fails the whole value closed.
// Superset of the upstream single-ref form (which also allows "Bearer ${env:…}").
function expandEnvRefs(value: string): string | null {
  let missing = false;
  const out = value.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, v: string) => {
    const val = process.env[v];
    if (!val) {
      missing = true;
      return "";
    }
    return val;
  });
  return missing ? null : out;
}

// Resolve host-declared servers at call time (env is fixed per deploy, the
// file is tiny, and call-time reads keep tests hermetic). Non-http transports
// (stdio) and non-https URLs are skipped: fail closed, never throw.
export function resolveMcpServers(): Record<string, McpServerConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(process.cwd(), ".agenthood", "config.json"), "utf8"));
  } catch {
    return {};
  }
  const declared = (raw as { mcpServers?: Record<string, Record<string, unknown>> }).mcpServers;
  if (!declared || typeof declared !== "object") return {};
  const out: Record<string, McpServerConfig> = {};
  for (const [name, cfg] of Object.entries(declared)) {
    if (!/^[a-z0-9-]+$/.test(name) || !cfg || typeof cfg !== "object") continue;
    if (cfg.transport !== "http" || typeof cfg.url !== "string") continue;
    const url = expandEnvRefs(cfg.url);
    if (!url) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    const rawHeaders = (cfg.headers && typeof cfg.headers === "object" ? cfg.headers : {}) as Record<string, unknown>;
    const headers: Record<string, string> = {};
    let headersOk = true;
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (typeof v !== "string") continue;
      const expanded = expandEnvRefs(v);
      if (expanded === null) {
        headersOk = false;
        break;
      }
      headers[k] = expanded;
    }
    if (!headersOk) continue;
    out[name] = { url, headers };
  }
  return out;
}

export function isMcpToolConfigured(name: string): boolean {
  const parsed = parseMcpToolName(name);
  if (!parsed) return false;
  return Boolean(resolveMcpServers()[parsed.server]);
}

async function mcpFetch(serverCfg: McpServerConfig, body: unknown, signal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => ctrl.abort());
  try {
    return await fetch(serverCfg.url, {
      method: "POST",
      signal: ctrl.signal,
      // A redirect would hand the bearer token to a host the allowlist never
      // saw — same reason web_fetch checks every hop. Here hops are banned.
      redirect: "error",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...serverCfg.headers },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function executeMcpTool(
  server: string,
  tool: string,
  serverCfg: McpServerConfig,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const start = Date.now();
  const done = (ok: boolean) => logger.info("mcp.call", { server, tool, durationMs: Date.now() - start, ok });
  let res: Response;
  try {
    res = await mcpFetch(
      serverCfg,
      { jsonrpc: "2.0", id: `${Date.now()}`, method: "tools/call", params: { name: tool, arguments: args } },
      signal,
    );
  } catch (err) {
    done(false);
    return `Error: MCP ${tool} request failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (!res.ok) {
    done(false);
    return `Error: MCP ${tool} HTTP ${res.status}`;
  }
  let payload: { result?: { content?: { type?: string; text?: string }[] | string }; error?: { message?: string } };
  try {
    payload = JSON.parse(await readBoundedText(res.body));
  } catch {
    done(false);
    return `Error: MCP ${tool} returned a non-JSON response`;
  }
  if (!payload || typeof payload !== "object") {
    done(false);
    return `Error: MCP ${tool} returned a non-JSON response`;
  }
  if (payload.error) {
    done(false);
    return `Error: MCP ${tool} failed: ${payload.error.message ?? "unknown error"}`;
  }
  const content = payload.result?.content;
  const text = Array.isArray(content)
    ? content.filter((c) => c && c.type === "text" && typeof c.text === "string").map((c) => c.text as string).join("\n")
    : typeof content === "string"
      ? content
      : "";
  done(true);
  // Never log args or results — names and outcome only (upstream audit rule).
  return text.slice(0, TOOL_RESULT_MAX_CHARS);
}

// Dynamic schemas for one server: listTools filtered to the requested names so
// the model is never shown tools the caller did not ask for.
async function listMcpToolSchemas(
  server: string,
  serverCfg: McpServerConfig,
  signal?: AbortSignal,
): Promise<ToolSchema[]> {
  let res: Response;
  try {
    res = await mcpFetch(serverCfg, { jsonrpc: "2.0", id: `${Date.now()}`, method: "tools/list", params: {} }, signal);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  let payload: { result?: { tools?: { name?: unknown; description?: unknown; inputSchema?: unknown }[] } };
  try {
    payload = JSON.parse(await readBoundedText(res.body));
  } catch {
    return [];
  }
  const tools = payload?.result?.tools;
  if (!Array.isArray(tools)) return [];
  const out: ToolSchema[] = [];
  for (const t of tools.slice(0, 50)) {
    if (typeof t?.name !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(t.name)) continue;
    out.push({
      name: `mcp__${server}__${t.name}`,
      description: typeof t.description === "string" ? t.description : `MCP tool ${t.name} on ${server}`,
      inputSchema: (t.inputSchema && typeof t.inputSchema === "object" ? t.inputSchema : { type: "object" }) as ToolSchema["inputSchema"],
    });
  }
  return out;
}

// Schemas for explicitly requested MCP names, grouped so each configured
// server is listed at most once per turn.
export async function getMcpToolSchemas(names: string[], signal?: AbortSignal): Promise<ToolSchema[]> {
  const servers = resolveMcpServers();
  const byServer = new Map<string, string[]>();
  for (const n of names) {
    const parsed = parseMcpToolName(n);
    if (!parsed || !servers[parsed.server]) continue;
    const list = byServer.get(parsed.server) ?? [];
    list.push(n);
    byServer.set(parsed.server, list);
  }
  const out: ToolSchema[] = [];
  for (const [server, wanted] of byServer) {
    const schemas = await listMcpToolSchemas(server, servers[server], signal);
    out.push(...schemas.filter((s) => wanted.includes(s.name)));
  }
  return out;
}

// Grant rule: declared in config ∩ https remote ∩ known member. There is no
// `restricted` lane in the Studio today, so any member the registry knows may
// use a configured readOnly server — the readOnly lane matches web_fetch.
export function isMcpToolAllowedForMember(agentId: string, toolName: string): boolean {
  const parsed = parseMcpToolName(toolName);
  if (!parsed || !resolveMcpServers()[parsed.server]) return false;
  return Boolean(getAgentById(agentId));
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
  const parsed = parseMcpToolName(name);
  if (parsed) {
    const serverCfg = resolveMcpServers()[parsed.server];
    if (!serverCfg) return `Error: MCP tool "${name}" is not configured (remote HTTP only, no server allowlisted)`;
    return executeMcpTool(parsed.server, parsed.tool, serverCfg, args, signal);
  }
  if (isMcpToolName(name)) return `Error: MCP tool "${name}" is not configured (remote HTTP only, no server allowlisted)`;
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
