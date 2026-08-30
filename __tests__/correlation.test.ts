import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReadableStream } from "node:stream/web";

const { chatStub } = vi.hoisted(() => ({ chatStub: vi.fn() }));

vi.mock("@/app/(main)/studio/_lib/agenthood-adapter", () => ({
  LightweightAdapter: class {
    chat = chatStub;
  },
}));

function doneStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"type":"done"}\n'));
      controller.close();
    },
  });
}

describe("X-Correlation-Id propagation on chat route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    chatStub.mockReset();
    chatStub.mockResolvedValue(doneStream());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function makeRequest(correlationId?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (correlationId !== undefined) headers["X-Correlation-Id"] = correlationId;
    return new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: null,
      }),
    });
  }

  it("echoes a provided X-Correlation-Id in the response headers", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_REQUIRED = "false";

    const { POST } = await import("../app/api/studio/chat/route");
    const res = await POST(makeRequest("client-session-42"));
    expect(res.headers.get("X-Correlation-Id")).toBe("client-session-42");
  });

  it("generates an X-Correlation-Id when the header is absent", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_REQUIRED = "false";

    const { POST } = await import("../app/api/studio/chat/route");
    const res = await POST(makeRequest());
    expect(res.headers.get("X-Correlation-Id")).toBeTruthy();
  });

  it("rejects an oversized X-Correlation-Id header", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_REQUIRED = "false";

    const { POST } = await import("../app/api/studio/chat/route");
    const res = await POST(makeRequest("x".repeat(129)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid X-Correlation-Id");
  });
});
