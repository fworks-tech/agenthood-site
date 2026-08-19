import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_ENABLED;
  delete process.env.KV_URL;
  delete process.env.KV_TOKEN;
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

const VALID_BODY = { name: "Ada", text: "Great post", slug: "hello-world" };

async function post(body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import("../app/api/news/comments/route");
  return POST(
    new Request("http://localhost/api/news/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("news comments route captcha gating", () => {
  it("rejects a missing token when Turnstile is configured", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    const res = await post({ ...VALID_BODY, token: "" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Captcha verification failed");
  });

  it("bypasses the captcha gate when Turnstile is unconfigured", async () => {
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("Storage unavailable");
  });

  it("bypasses the captcha gate when only the site key is set", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("Storage unavailable");
  });

  it("bypasses the captcha gate when explicitly disabled even with both keys set", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = "false";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
    const res = await post(VALID_BODY);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("Storage unavailable");
  });
});
