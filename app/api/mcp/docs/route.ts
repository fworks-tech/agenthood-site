import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/app/_lib/studio-server/logger";
import { TOOL_RESULT_MAX_CHARS } from "@/app/_lib/studio-server/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Same-app readOnly docs MCP server (ADR-013, issue #371). Speaks the exact
// two JSON-RPC methods the Studio client sends (tools/list + tools/call);
// anything else answers Method not found. Bearer-gated: without
// MCP_DOCS_AUTH_TOKEN every request is 401 and the corpus is never touched.
const CONTENT_DIR = join(process.cwd(), "content");
const SEARCH_READ_CHARS = 20_000;
const SNIPPET_CHARS = 300;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

type RpcId = string | number | null;

function rpcOk(id: RpcId, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcErr(id: RpcId, code: number, message: string, httpStatus = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: httpStatus });
}

function titleFromHeadings(text: string, fallback: string): string {
  for (const line of text.split("\n").slice(0, 20)) {
    const m = /^#{1,3}\s+(.+?)\s*$/.exec(line.trim());
    if (m) return m[1].slice(0, 120);
  }
  return fallback;
}

async function manifestTitles(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const name of ["docs", "news"]) {
    try {
      const raw = await readFile(join(CONTENT_DIR, name, "manifest.json"), "utf8");
      const entries = JSON.parse(raw) as { path?: unknown; title?: unknown }[];
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if (typeof e?.path === "string" && typeof e?.title === "string") out.set(e.path, e.title);
      }
    } catch {
      // Manifest absent (e.g. docs/ before sync) — headings are the fallback.
    }
  }
  return out;
}

async function listCorpusFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(rel: string, recursive: boolean): Promise<void> {
    let names: string[];
    try {
      names = await readdir(join(CONTENT_DIR, rel));
    } catch {
      return; // dir absent (docs/ before sync) — news-only corpus, by design
    }
    for (const n of names) {
      if (n === "manifest.json" || n.startsWith(".")) continue;
      if (!n.endsWith(".md")) {
        if (recursive) await walk(`${rel}/${n}`, true);
        continue;
      }
      out.push(`${rel}/${n}`);
    }
  }
  await walk("docs", true);
  await walk("news", false);
  return out.slice(0, 500);
}

interface SearchHit {
  path: string;
  title: string;
  snippet: string;
}

async function searchCorpus(q: string, limit: number): Promise<SearchHit[]> {
  const needle = q.toLowerCase();
  const titles = await manifestTitles();
  const files = await listCorpusFiles();
  const scored: { score: number; hit: SearchHit }[] = [];
  for (const rel of files) {
    let text: string;
    try {
      text = (await readFile(join(CONTENT_DIR, rel), "utf8")).slice(0, SEARCH_READ_CHARS);
    } catch {
      continue;
    }
    const title = titles.get(rel) ?? titleFromHeadings(text, rel);
    let score = 0;
    if (title.toLowerCase().includes(needle)) score += 10;
    let headingHits = 0;
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith("#") && t.toLowerCase().includes(needle)) headingHits++;
    }
    score += Math.min(headingHits, 3) * 5;
    const body = text.toLowerCase();
    let count = 0;
    let idx = body.indexOf(needle);
    while (idx !== -1 && count < 6) {
      count++;
      idx = body.indexOf(needle, idx + needle.length);
    }
    score += Math.min(count, 5);
    if (score === 0) continue;
    const first = body.indexOf(needle);
    const start = Math.max(0, first - 150);
    const snippet = text.slice(start, start + SNIPPET_CHARS).replace(/\s+/g, " ").trim();
    scored.push({ score, hit: { path: rel, title, snippet } });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.hit);
}

const SEARCH_SCHEMA = {
  name: "search",
  description: "Search the site docs and news corpus by keyword. Returns ranked path/title/snippet matches.",
  inputSchema: {
    type: "object",
    properties: {
      q: { type: "string", description: "Keyword query" },
      limit: { type: "integer", description: "Max results (default 5, max 10)", minimum: 1, maximum: 10 },
    },
    required: ["q"],
  },
};

const FETCH_SCHEMA = {
  name: "fetch",
  description: "Fetch the full markdown body of one corpus file by its search path.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Corpus path from search, e.g. news/<slug>.md" },
    },
    required: ["path"],
  },
};

export async function POST(request: Request): Promise<Response> {
  // Auth before anything else: no token configured, or a wrong one, fails
  // closed with 401 and never touches the corpus.
  const token = process.env.MCP_DOCS_AUTH_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    logger.warn("mcp.docs.unauthorized", {});
    return rpcErr(null, -32001, "Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn("mcp.docs.invalid", { ok: false });
    return rpcErr(null, -32700, "Parse error: body must be valid JSON");
  }
  const id: RpcId =
    body && typeof body === "object" && ("id" in body)
      ? (body as { id: unknown }).id as RpcId
      : null;
  if (!body || typeof body !== "object" || (body as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
    return rpcErr(id ?? null, -32600, "Invalid Request: jsonrpc 2.0 object required");
  }
  const { method, params } = body as { method?: unknown; params?: unknown };
  const args = params && typeof params === "object" ? (params as Record<string, unknown>) : null;

  if (method === "tools/list") {
    logger.info("mcp.docs", { method: "tools/list", ok: true });
    return rpcOk(id, { tools: [SEARCH_SCHEMA, FETCH_SCHEMA] });
  }

  if (method === "tools/call") {
    const name = args?.name;
    const callArgs = args?.arguments;
    if (typeof name !== "string" || !callArgs || typeof callArgs !== "object" || Array.isArray(callArgs)) {
      return rpcErr(id, -32602, "Invalid params: { name: string, arguments: object } required");
    }
    const a = callArgs as Record<string, unknown>;

    if (name === "search") {
      if (typeof a.q !== "string" || a.q.trim().length === 0 || a.q.length > 200) {
        return rpcErr(id, -32602, "Invalid params: q must be a non-empty string (max 200 chars)");
      }
      const limit =
        a.limit === undefined
          ? DEFAULT_LIMIT
          : typeof a.limit === "number" && Number.isInteger(a.limit)
            ? Math.min(Math.max(a.limit, 1), MAX_LIMIT)
            : NaN;
      if (Number.isNaN(limit)) return rpcErr(id, -32602, "Invalid params: limit must be an integer 1-10");
      const hits = await searchCorpus(a.q.trim(), limit);
      logger.info("mcp.docs", { method: "tools/call", tool: "search", ok: true });
      return rpcOk(id, { content: [{ type: "text", text: JSON.stringify(hits).slice(0, TOOL_RESULT_MAX_CHARS) }] });
    }

    if (name === "fetch") {
      if (typeof a.path !== "string") {
        return rpcErr(id, -32602, "Invalid params: path must be a string");
      }
      // shortcut: substring allowlist over the enumerated corpus — no
      // traversal can escape content/ because only listed files are readable.
      // Upgrade to a manifest-only allowlist if the corpus grows past ~500 files.
      const files = await listCorpusFiles();
      if (!files.includes(a.path)) {
        logger.warn("mcp.docs", { method: "tools/call", tool: "fetch", ok: false });
        return rpcErr(id, -32602, "Invalid params: unknown corpus path");
      }
      let text: string;
      try {
        text = (await readFile(join(CONTENT_DIR, a.path), "utf8")).slice(0, TOOL_RESULT_MAX_CHARS);
      } catch {
        return rpcErr(id, -32603, "Internal error: corpus file unreadable");
      }
      logger.info("mcp.docs", { method: "tools/call", tool: "fetch", ok: true });
      return rpcOk(id, { content: [{ type: "text", text }] });
    }

    return rpcErr(id, -32601, `Method not found: tools/call ${name}`);
  }

  return rpcErr(id, -32601, `Method not found: ${typeof method === "string" ? method : "?"}`);
}
