import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@upstash/redis", () => ({
  Redis: class {},
}));

const { ratelimitInstances } = vi.hoisted(() => {
  const ratelimitInstances: Array<{ prefix: string; limit: ReturnType<typeof vi.fn> }> = [];
  return { ratelimitInstances };
});

vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    static slidingWindow = vi.fn(() => ({}));
    limit: ReturnType<typeof vi.fn>;
    constructor(opts: { prefix: string }) {
      this.limit = vi.fn();
      ratelimitInstances.push({ prefix: opts.prefix, limit: this.limit });
    }
  }
  return { Ratelimit };
});

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv, NODE_ENV: "test" };
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  ratelimitInstances.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

function makeRequest(pathname: string, extraHeaders: Record<string, string> = {}): NextRequest {
  const url = pathname.startsWith("http")
    ? pathname
    : `https://agenthood.flabs.tech${pathname}`;
  return new NextRequest(url, {
    method: "GET",
    headers: { "x-forwarded-for": "1.2.3.4", ...extraHeaders },
  });
}

async function callMiddleware(request: NextRequest): Promise<Response> {
  const { middleware } = await import("../app/middleware");
  return middleware(request);
}

describe("middleware origin validation", () => {
  it("allows requests from the production origin", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "https://agenthood.flabs.tech" }),
    );
    expect(res.status).toBe(200);
  });

  it("allows requests without an origin or referer", async () => {
    const res = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(res.status).toBe(200);
  });

  it("allows requests whose referer matches the allowed origin", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { referer: "https://agenthood.flabs.tech/studio/playground" }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects foreign origins with 403", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("rejects an unparseable referer with 403", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { referer: "::::not-a-url" }),
    );
    expect(res.status).toBe(403);
  });

  it("does not validate origin on non-chat studio routes", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/agents", { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects foreign origins for the tools endpoint", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/tools/execute/", { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("rejects foreign origins for the feedback endpoint", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/feedback", { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("rejects foreign origins for the workspaces sub-routes", async () => {
    const res = await callMiddleware(
      makeRequest("/api/studio/workspaces/synthesize", { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("allows same-origin feedback and workspaces requests", async () => {
    const fb = await callMiddleware(
      makeRequest("/api/studio/feedback", { origin: "https://agenthood.flabs.tech" }),
    );
    expect(fb.status).toBe(200);
    const ws = await callMiddleware(
      makeRequest("/api/studio/workspaces", { origin: "https://agenthood.flabs.tech" }),
    );
    expect(ws.status).toBe(200);
  });

  it("allows localhost origins in development mode", async () => {
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "development";
    const res = await callMiddleware(
      makeRequest("http://localhost:3000/api/studio/chat", { origin: "http://localhost:3000" }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects the production origin in development mode", async () => {
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "development";
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "https://agenthood.flabs.tech" }),
    );
    expect(res.status).toBe(403);
  });

  it("allows preview origins from VERCEL_URL", async () => {
    process.env.VERCEL_URL = "agenthood-site-git-preview-fworks.vercel.app";
    vi.resetModules();
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "https://agenthood-site-git-preview-fworks.vercel.app" }),
    );
    expect(res.status).toBe(200);
  });

  it("ignores invalid ALLOWED_ORIGINS entries", async () => {
    process.env.ALLOWED_ORIGINS = "*,http://insecure.example,https://preview.example.com";
    vi.resetModules();
    const evil = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "http://insecure.example" }),
    );
    expect(evil.status).toBe(403);
    const ok = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "https://preview.example.com" }),
    );
    expect(ok.status).toBe(200);
  });

  it("fails closed on paid routes when KV is missing in production", async () => {
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "production";
    vi.resetModules();
    const res = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("keeps the public agents list open when KV is missing in production", async () => {
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "production";
    vi.resetModules();
    const res = await callMiddleware(makeRequest("/api/studio/agents"));
    expect(res.status).toBe(200);
  });

  it("prefers x-real-ip over a spoofable leftmost x-forwarded-for", async () => {
    const request = new NextRequest("https://agenthood.flabs.tech/api/studio/chat", {
      method: "GET",
      headers: { "x-forwarded-for": "1.1.1.1", "x-real-ip": "9.9.9.9" },
    });
    for (let i = 0; i < 20; i += 1) {
      const res = await callMiddleware(request);
      expect(res.status).not.toBe(429);
    }
    expect((await callMiddleware(request)).status).toBe(429);
    const otherRealIp = new NextRequest("https://agenthood.flabs.tech/api/studio/chat", {
      method: "GET",
      headers: { "x-forwarded-for": "1.1.1.1", "x-real-ip": "8.8.8.8" },
    });
    expect((await callMiddleware(otherRealIp)).status).toBe(200);
  });
});

describe("middleware in-memory rate limiting", () => {
  it("allows requests below the chat limit and throttles the next one", async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = await callMiddleware(makeRequest("/api/studio/chat"));
      expect(res.status).not.toBe(429);
    }
    const throttled = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(throttled.status).toBe(429);
    const body = await throttled.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(throttled.headers.get("Retry-After")).toBeTruthy();
    expect(throttled.headers.get("RateLimit-Remaining")).toBe("0");
  });

  it("isolates rate limits per client IP", async () => {
    for (let i = 0; i < 20; i += 1) {
      await callMiddleware(makeRequest("/api/studio/chat"));
    }
    const otherIp = await callMiddleware(
      makeRequest("/api/studio/chat", { "x-forwarded-for": "5.6.7.8" }),
    );
    expect(otherIp.status).toBe(200);
  });

  it("adds rate-limit headers on subsequent allowed requests", async () => {
    await callMiddleware(makeRequest("/api/studio/chat"));
    const second = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(second.headers.get("RateLimit-Limit")).toBe("20");
    expect(second.headers.get("RateLimit-Remaining")).toBe("18");
  });

  it("applies the agents limit independently of the chat limit", async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = await callMiddleware(makeRequest("/api/studio/chat"));
      expect(res.status).not.toBe(429);
    }
    const throttled = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(throttled.status).toBe(429);

    const agents = await callMiddleware(makeRequest("/api/studio/agents"));
    expect(agents.status).toBe(200);
    const agentsAgain = await callMiddleware(makeRequest("/api/studio/agents"));
    expect(agentsAgain.status).toBe(200);
    expect(agentsAgain.headers.get("RateLimit-Limit")).toBe("60");
  });

  it("keys rate limits by x-real-ip when no forwarded header is present", async () => {
    const request = new NextRequest("https://agenthood.flabs.tech/api/studio/chat", {
      method: "GET",
      headers: { "x-real-ip": "9.9.9.9" },
    });
    for (let i = 0; i < 20; i += 1) {
      const res = await callMiddleware(request);
      expect(res.status).not.toBe(429);
    }
    const throttled = await callMiddleware(request);
    expect(throttled.status).toBe(429);
  });

  it("leaves unknown studio paths unthrottled", async () => {
    const res = await callMiddleware(makeRequest("/api/studio/auth"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBeNull();
  });

  it("applies the tools limit independently of the chat limit", async () => {
    for (let i = 0; i < 100; i += 1) {
      const res = await callMiddleware(makeRequest("/api/studio/tools/execute"));
      expect(res.status).not.toBe(429);
    }
    const throttled = await callMiddleware(makeRequest("/api/studio/tools/execute"));
    expect(throttled.status).toBe(429);

    const chatRes = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(chatRes.status).toBe(200);
    const chatAgain = await callMiddleware(makeRequest("/api/studio/chat"));
    expect(chatAgain.headers.get("RateLimit-Limit")).toBe("20");
  });

  it("normalizes trailing slashes into the same rate-limit bucket", async () => {
    for (let i = 0; i < 100; i += 1) {
      const res = await callMiddleware(makeRequest("/api/studio/tools/execute/"));
      expect(res.status).not.toBe(429);
    }
    const throttled = await callMiddleware(makeRequest("/api/studio/tools/execute/"));
    expect(throttled.status).toBe(429);
  });
});

describe("middleware Upstash rate limiting", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = "https://fake-kv.example.com";
    process.env.KV_REST_API_TOKEN = "test-token";
  });

  it("forwards limit headers when Upstash allows the request", async () => {
    const { middleware } = await import("../app/middleware");
    const chat = ratelimitInstances.find((r) => r.prefix === "ratelimit:chat");
    expect(chat).toBeDefined();
    chat!.limit.mockResolvedValueOnce({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60_000,
    });
    const res = await middleware(makeRequest("/api/studio/chat"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("20");
    expect(res.headers.get("RateLimit-Remaining")).toBe("19");
  });

  it("returns 429 with Retry-After when Upstash throttles the request", async () => {
    const { middleware } = await import("../app/middleware");
    const chat = ratelimitInstances.find((r) => r.prefix === "ratelimit:chat");
    expect(chat).toBeDefined();
    chat!.limit.mockResolvedValueOnce({
      success: false,
      limit: 20,
      remaining: 0,
      reset: Date.now() + 30_000,
    });
    const res = await middleware(makeRequest("/api/studio/chat"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("routes /api/studio/tools/execute to the tools Upstash limiter", async () => {
    const { middleware } = await import("../app/middleware");
    const tools = ratelimitInstances.find((r) => r.prefix === "ratelimit:tools");
    const chat = ratelimitInstances.find((r) => r.prefix === "ratelimit:chat");
    expect(tools).toBeDefined();
    tools!.limit.mockResolvedValueOnce({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });
    const res = await middleware(makeRequest("/api/studio/tools/execute"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("100");
    expect(tools!.limit).toHaveBeenCalledTimes(1);
    expect(chat!.limit).not.toHaveBeenCalled();
  });

  it("routes /api/studio/feedback to the feedback Upstash limiter", async () => {
    const { middleware } = await import("../app/middleware");
    const feedback = ratelimitInstances.find((r) => r.prefix === "ratelimit:feedback");
    expect(feedback).toBeDefined();
    feedback!.limit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 58,
      reset: Date.now() + 60_000,
    });
    const res = await middleware(makeRequest("/api/studio/feedback"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("60");
  });

  it("routes /api/news/comments to its own Upstash limiter", async () => {
    const { middleware } = await import("../app/middleware");
    const comments = ratelimitInstances.find((r) => r.prefix === "ratelimit:comments");
    expect(comments).toBeDefined();
    comments!.limit.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 10_000,
    });
    const res = await middleware(makeRequest("/api/news/comments"));
    expect(res.status).toBe(429);
    expect(res.headers.get("RateLimit-Limit")).toBe("30");
  });
});

describe("middleware Jev protection", () => {
  it("rejects foreign origins for the Jev proxy and its workspace bridge", async () => {
    expect((await callMiddleware(makeRequest("/api/studio/jev", { origin: "https://evil.example" }))).status).toBe(403);
    expect((await callMiddleware(makeRequest("/api/studio/workspaces/jev", { origin: "https://evil.example" }))).status).toBe(403);
  });

  it("throttles the Jev proxy at 20/min", async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await callMiddleware(makeRequest("/api/studio/jev"))).status).not.toBe(429);
    }
    expect((await callMiddleware(makeRequest("/api/studio/jev"))).status).toBe(429);
  });

  it("keeps the workspace Jev bridge in its own rate-limit bucket", async () => {
    for (let i = 0; i < 20; i += 1) {
      await callMiddleware(makeRequest("/api/studio/workspaces/jev"));
    }
    expect((await callMiddleware(makeRequest("/api/studio/workspaces/jev"))).status).toBe(429);
    expect((await callMiddleware(makeRequest("/api/studio/jev"))).status).toBe(200);
  });
});

describe("middleware Upstash Jev limiter", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = "https://fake-kv.example.com";
    process.env.KV_REST_API_TOKEN = "test-token";
  });

  it("routes /api/studio/jev to its own Upstash limiter", async () => {
    const { middleware } = await import("../app/middleware");
    const jev = ratelimitInstances.find((r) => r.prefix === "ratelimit:jev");
    expect(jev).toBeDefined();
    jev!.limit.mockResolvedValueOnce({
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60_000,
    });
    const res = await middleware(makeRequest("/api/studio/jev"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("20");
    expect(jev!.limit).toHaveBeenCalledTimes(1);
  });
});