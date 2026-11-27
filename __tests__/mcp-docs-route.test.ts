import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "../app/api/mcp/docs/route";

const originalEnv = process.env;
const URL = "http://localhost/api/mcp/docs";

function call(body: unknown, token: string | null = "test-secret"): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return POST(
    new Request(URL, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const rpc = (method: string, params: unknown = {}, id: unknown = 1) => ({ jsonrpc: "2.0", id, method, params });

beforeEach(() => {
  process.env = { ...originalEnv, MCP_DOCS_AUTH_TOKEN: "test-secret" };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("POST /api/mcp/docs auth", () => {
  it("returns 401 without a bearer and with a wrong one", async () => {
    const anon = await call(rpc("tools/list"), null);
    expect(anon.status).toBe(401);
    const wrong = await call(rpc("tools/list"), "nope");
    expect(wrong.status).toBe(401);
  });

  it("fails closed when no token is configured", async () => {
    delete process.env.MCP_DOCS_AUTH_TOKEN;
    const res = await call(rpc("tools/list"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/mcp/docs tools/list", () => {
  it("lists exactly search + fetch with valid schemas", async () => {
    const res = await call(rpc("tools/list"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(["search", "fetch"]);
    for (const t of body.result.tools) {
      expect(t.name).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(t.inputSchema?.type).toBe("object");
    }
  });

  it("rejects unknown methods and malformed envelopes", async () => {
    const unknown = await (await call(rpc("nope"))).json();
    expect(unknown.error.code).toBe(-32601);
    const bad = await (await call({ method: "tools/list" })).json();
    expect(bad.error.code).toBe(-32600);
    const broken = await call("this is not json");
    expect((await broken.json()).error.code).toBe(-32700);
  });
});

describe("POST /api/mcp/docs tools/call", () => {
  it("searches the corpus and caps limit", async () => {
    const res = await call(rpc("tools/call", { name: "search", arguments: { q: "MCP" } }));
    const body = await res.json();
    const hits = JSON.parse(body.result.content[0].text) as { path: string; title: string; snippet: string }[];
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(5);
    for (const h of hits) {
      expect(h.path).toMatch(/\.md$/);
      expect(h.title.length).toBeGreaterThan(0);
    }
    const capped = await call(rpc("tools/call", { name: "search", arguments: { q: "the", limit: 100 } }));
    const cappedHits = JSON.parse((await capped.json()).result.content[0].text) as unknown[];
    expect(cappedHits.length).toBeLessThanOrEqual(10);
  });

  it("rejects bad search params and unknown tools", async () => {
    for (const args of [{}, { q: "" }, { q: 42 }, { q: "x", limit: "many" }, { q: "x", limit: 2.5 }]) {
      const body = await (await call(rpc("tools/call", { name: "search", arguments: args }))).json();
      expect(body.error.code).toBe(-32602);
    }
    const body = await (await call(rpc("tools/call", { name: "drop", arguments: {} }))).json();
    expect(body.error.code).toBe(-32601);
  });

  it("fetches a search hit and rejects traversal", async () => {
    const search = await call(rpc("tools/call", { name: "search", arguments: { q: "MCP" } }));
    const hits = JSON.parse((await search.json()).result.content[0].text) as { path: string }[];
    const res = await call(rpc("tools/call", { name: "fetch", arguments: { path: hits[0].path } }));
    const text = (await res.json()).result.content[0].text as string;
    expect(text.length).toBeGreaterThan(0);

    for (const path of ["../package.json", "/etc/passwd", "news/manifest.json", "nope.md", "..\\secret.md"]) {
      const body = await (await call(rpc("tools/call", { name: "fetch", arguments: { path } }))).json();
      expect(body.error.code).toBe(-32602);
    }
  });
});
