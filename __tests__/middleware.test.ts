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

  it("allows localhost origins in development mode", async () => {
    process.env.NODE_ENV = "development";
    const res = await callMiddleware(
      makeRequest("http://localhost:3000/api/studio/chat", { origin: "http://localhost:3000" }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects the production origin in development mode", async () => {
    process.env.NODE_ENV = "development";
    const res = await callMiddleware(
      makeRequest("/api/studio/chat", { origin: "https://agenthood.flabs.tech" }),
    );
    expect(res.status).toBe(403);
  });
});

describe("middleware in-memory rate limiting", () => {
  it("allows requests below the chat limit and throttles the next one", async () => {
    for (let i = 0; i < 100; i += 1) {
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
    for (let i = 0; i < 100; i += 1) {
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
    expect(second.headers.get("RateLimit-Limit")).toBe("100");
    expect(second.headers.get("RateLimit-Remaining")).toBe("98");
  });

  it("applies the agents limit independently of the chat limit", async () => {
    for (let i = 0; i < 100; i += 1) {
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
    for (let i = 0; i < 100; i += 1) {
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
    expect(chatAgain.headers.get("RateLimit-Limit")).toBe("100");
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
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    });
    const res = await middleware(makeRequest("/api/studio/chat"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("100");
    expect(res.headers.get("RateLimit-Remaining")).toBe("99");
  });

  it("returns 429 with Retry-After when Upstash throttles the request", async () => {
    const { middleware } = await import("../app/middleware");
    const chat = ratelimitInstances.find((r) => r.prefix === "ratelimit:chat");
    expect(chat).toBeDefined();
    chat!.limit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 30_000,
    });
    const res = await middleware(makeRequest("/api/studio/chat"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("routes /api/studio/status to its own Upstash limiter", async () => {
    const { middleware } = await import("../app/middleware");
    const status = ratelimitInstances.find((r) => r.prefix === "ratelimit:status");
    const chat = ratelimitInstances.find((r) => r.prefix === "ratelimit:chat");
    expect(status).toBeDefined();
    status!.limit.mockResolvedValueOnce({
      success: true,
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
    });
    const res = await middleware(makeRequest("/api/studio/status"));
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("30");
    expect(status!.limit).toHaveBeenCalledTimes(1);
    expect(chat!.limit).not.toHaveBeenCalled();
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

  it("maps other rate-limited paths to the feedback Upstash limiter", async () => {
    const { middleware } = await import("../app/middleware");
    const feedback = ratelimitInstances.find((r) => r.prefix === "ratelimit:feedback");
    expect(feedback).toBeDefined();
    feedback!.limit.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 10_000,
    });
    const res = await middleware(makeRequest("/api/news/comments"));
    expect(res.status).toBe(429);
    expect(res.headers.get("RateLimit-Limit")).toBe("60");
  });
});