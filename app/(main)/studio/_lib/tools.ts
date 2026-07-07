import type { ToolSchema } from "agenthood/dist/llm/types";

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

export const MAX_TOOL_ITERATIONS = 5;
export const MAX_FETCH_SIZE = 100_000;
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
    .slice(0, MAX_FETCH_SIZE);
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

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Agenthood/1.0" },
    });
    if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`;

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();

    if (contentType.includes("text/html")) {
      const stripped = stripHtml(text);
      return stripped.slice(0, 15_000);
    }
    return text.slice(0, 15_000);
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
  const sandbox: Record<string, unknown> = {};
  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code, { filename: "user-code.js" });
    const result = script.runInContext(context, { timeout: 5000 });
    if (result === undefined) return "Executed successfully (undefined result)";
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
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
        "Execute JavaScript code in a sandboxed Node.js VM. Returns the result as a string. Has access to standard JS built-ins (Math, Date, JSON, etc). Timeout: 5 seconds.",
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
};

export function getToolSchemas(): ToolSchema[] {
  return Object.values(TOOL_DEFINITIONS).map((t) => t.schema);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const tool = TOOL_DEFINITIONS[name];
  if (!tool) return `Error: unknown tool "${name}"`;
  return tool.execute(args, signal);
}
