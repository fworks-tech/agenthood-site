import { readdir, readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
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

// Same secret-compare shape as the jev route: length check first, constant
// time after, so a wrong guess leaks nothing beyond rejection.
function tokenMatches(provided: string | null, secret: string): boolean {
  if (!provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

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
  // Silent bound shared by search and fetch: past 500 files both miss the
  // tail, so raise this (or go manifest-only) before the corpus grows here.
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

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

function invalidParams(message: string): RpcError {
  return new RpcError(-32602, `Invalid params: ${message}`);
}

async function handleSearch(args: Record<string, unknown>): Promise<unknown> {
  if (typeof args.q !== "string" || args.q.trim().length === 0 || args.q.length > 200) {
    throw invalidParams("q must be a non-empty string (max 200 chars)");
  }
  let limit = DEFAULT_LIMIT;
  if (args.limit !== undefined) {
    if (typeof args.limit !== "number" || !Number.isInteger(args.limit)) {
      throw invalidParams("limit must be an integer 1-10");
    }
    limit = Math.min(Math.max(args.limit, 1), MAX_LIMIT);
  }
  const hits = await searchCorpus(args.q.trim(), limit);
  return { content: [{ type: "text", text: JSON.stringify(hits).slice(0, TOOL_RESULT_MAX_CHARS) }] };
}

async function handleFetch(args: Record<string, unknown>): Promise<unknown> {
  if (typeof args.path !== "string") throw invalidParams("path must be a string");
  // shortcut: substring allowlist over the enumerated corpus — no
  // traversal can escape content/ because only listed files are readable.
  // Upgrade to a manifest-only allowlist if the corpus grows past ~500 files.
  const files = await listCorpusFiles();
  if (!files.includes(args.path)) {
    logger.warn("mcp.docs", { method: "tools/call", tool: "fetch", ok: false });
    throw invalidParams("unknown corpus path");
  }
  try {
    return {
      content: [
        { type: "text", text: (await readFile(join(CONTENT_DIR, args.path), "utf8")).slice(0, TOOL_RESULT_MAX_CHARS) },
      ],
    };
  } catch {
    throw new RpcError(-32603, "Internal error: corpus file unreadable");
  }
}

export async function POST(request: Request): Promise<Response> {
  // Auth before anything else: no token configured, or a wrong one, fails
  // closed with 401 and never touches the corpus.
  const token = process.env.MCP_DOCS_AUTH_TOKEN;
  if (!token || !tokenMatches(request.headers.get("authorization"), `Bearer ${token}`)) {
    logger.warn("mcp.docs.unauthorized", {});
    return rpcErr(null, -32001, "Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn("mcp.docs.invalid", {});
    return rpcErr(null, -32700, "Parse error: body must be valid JSON");
  }
  const id: RpcId =
    body && typeof body === "object" && ("id" in body)
      ? (body as { id: unknown }).id as RpcId
      : null;
  if (!body || typeof body !== "object" || (body as { jsonrpc?: unknown }).jsonrpc !== "2.0") {
    return rpcErr(id, -32600, "Invalid Request: jsonrpc 2.0 object required");
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
    try {
      if (name === "search") {
        const result = await handleSearch(callArgs as Record<string, unknown>);
        logger.info("mcp.docs", { method: "tools/call", tool: "search", ok: true });
        return rpcOk(id, result);
      }
      if (name === "fetch") {
        const result = await handleFetch(callArgs as Record<string, unknown>);
        logger.info("mcp.docs", { method: "tools/call", tool: "fetch", ok: true });
        return rpcOk(id, result);
      }
    } catch (err) {
      if (err instanceof RpcError) return rpcErr(id, err.code, err.message);
      throw err;
    }

    return rpcErr(id, -32601, `Method not found: tools/call ${name}`);
  }

  return rpcErr(id, -32601, `Method not found: ${typeof method === "string" ? method : "?"}`);
}
