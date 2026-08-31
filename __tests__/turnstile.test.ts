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

describe("Turnstile CAPTCHA validation", () => {
  const originalEnv = process.env;
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.stubGlobal("fetch", fetchSpy);
    chatStub.mockReset();
    chatStub.mockResolvedValue(doneStream());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("bypasses validation when TURNSTILE_SECRET_KEY is missing", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_REQUIRED = "false";

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: null,
      }),
    });

    const res = await POST(req);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("rejects missing token when env vars are set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing CAPTCHA token");
    expect(body.code).toBe("CAPTCHA_FAILED");
  });

  it("rejects empty string token when env vars are set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: "",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing CAPTCHA token");
  });

  it("rejects invalid token when Cloudflare returns success: false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    fetchSpy.mockResolvedValueOnce({
      json: async () => ({ success: false }),
    });

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: "invalid-token",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("CAPTCHA verification failed");
    expect(body.code).toBe("CAPTCHA_FAILED");
  });

  it("handles Cloudflare API unreachable gracefully", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: "some-token",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("CAPTCHA service unavailable");
  });

  it("accepts valid token when Cloudflare returns success: true", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    fetchSpy.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: "valid-token",
      }),
    });

    const res = await POST(req);
    expect(fetchSpy).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("skips siteverify and sets a signed cookie on successful verification", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    fetchSpy.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        turnstileToken: "valid-token",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("captcha_verified=1:");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Max-Age=86400");
  });

  it("honours a valid signed cookie without a token (one-shot gate)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    const { createCaptchaCookieValue } = await import("../app/(main)/studio/_lib/captcha");
    const signed = await createCaptchaCookieValue();

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `captcha_verified=${signed}`,
      },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      }),
    });

    const res = await POST(req);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("rejects a forged unsigned cookie and requires a token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "captcha_verified=1",
      },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      }),
    });

    const res = await POST(req);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CAPTCHA_FAILED");
  });

  it("rejects an expired signed cookie", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";

    // Craft a cookie whose signature is valid for an already-past expiry.
    const secret = "test-secret";
    const past = Math.floor(Date.now() / 1000) - 100;
    const data = `v1:${past}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { POST } = await import("../app/api/studio/chat/route");
    const req = new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `captcha_verified=1:${past}:${hex}`,
      },
      body: JSON.stringify({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "hello" }],
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      }),
    });

    const res = await POST(req);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("CAPTCHA_FAILED");
  });
});
