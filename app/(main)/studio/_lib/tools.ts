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
  const url = args.url as string;
  if (!url) return "Error: url is required";

  if (!isAllowedFetchUrl(url)) {
    return `Error: URL not allowed. Allowed hosts: ${ALLOWED_FETCH_HOSTS.join(", ")}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => ctrl.abort());

  const headers = { "User-Agent": "Agenthood/1.0" };
  const doFetch = () => fetch(url, { signal: ctrl.signal, headers });

  try {
    let res = await doFetch();
    // Single retry on 5xx: hosts (notably GitHub) intermittently 503
    // datacenter egress. 4xx is the caller's mistake — no retry.
    if (res.status >= 500 && res.status < 600) {
      try { await res.body?.cancel(); } catch { /* drop the error body */ }
      await new Promise((r) => setTimeout(r, 500));
      res = await doFetch();
    }
    if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`;

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();

    if (contentType.includes("text/html")) {
      const stripped = stripHtml(text);
      return stripped.slice(0, TOOL_RESULT_MAX_CHARS);
    }
    return text.slice(0, TOOL_RESULT_MAX_CHARS);
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    clearTimeout(timer);
  }
}

async function codeExecutionHandler(
  args: Record<string, unknown>,
): Promise<string> {
  const code = args.code as string;
  if (!code) return "Error: code is required";

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
    const result = script.runInContext(context, { timeout: 5000 });
    if (result === undefined) return "Executed successfully (undefined result)";
    // Same cap as web_fetch: large outputs are re-sent on every loop
    // iteration, so an unsliced dump would blow the context budget.
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return text.slice(0, TOOL_RESULT_MAX_CHARS);
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
