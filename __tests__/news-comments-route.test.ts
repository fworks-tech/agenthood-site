import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const commands = vi.hoisted(() => ({
  Redis: vi.fn(),
  rpush: vi.fn(async () => 1),
  ltrim: vi.fn(async () => "OK"),
  lrange: vi.fn(async () => [] as string[]),
}));

vi.mock("@upstash/redis", () => {
  commands.Redis.mockImplementation(function () {
    return {
      rpush: commands.rpush,
      ltrim: commands.ltrim,
      lrange: commands.lrange,
    };
  });
  return { Redis: commands.Redis };
});

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_ENABLED;
  delete process.env.KV_URL;
  delete process.env.KV_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  commands.Redis.mockClear();
  commands.rpush.mockReset().mockResolvedValue(1);
  commands.ltrim.mockReset().mockResolvedValue("OK");
  commands.lrange.mockReset().mockResolvedValue([]);
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

async function get(slug: string): Promise<Response> {
  const { GET } = await import("../app/api/news/comments/route");
  return GET(new NextRequest(`http://localhost/api/news/comments?slug=${slug}`));
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

describe("news comments route storage", () => {
  it("uses the documented Vercel KV variables when available", async () => {
    process.env.KV_REST_API_URL = "https://doc.example";
    process.env.KV_REST_API_TOKEN = "doc-token";
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    expect(commands.Redis).toHaveBeenCalledWith({ url: "https://doc.example", token: "doc-token" });
  });

  it("falls back to the legacy KV variables", async () => {
    process.env.KV_URL = "https://legacy.example";
    process.env.KV_TOKEN = "legacy-token";
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    expect(commands.Redis).toHaveBeenCalledWith({ url: "https://legacy.example", token: "legacy-token" });
  });

  it("prefers the documented variables when both pairs are set", async () => {
    process.env.KV_REST_API_URL = "https://doc.example";
    process.env.KV_REST_API_TOKEN = "doc-token";
    process.env.KV_URL = "https://legacy.example";
    process.env.KV_TOKEN = "legacy-token";
    await post(VALID_BODY);
    expect(commands.Redis).toHaveBeenCalledWith({ url: "https://doc.example", token: "doc-token" });
  });

  it("trims the stored list to the newest 100 comments after a write", async () => {
    process.env.KV_REST_API_URL = "https://doc.example";
    process.env.KV_REST_API_TOKEN = "doc-token";
    const res = await post(VALID_BODY);
    expect(res.status).toBe(200);
    expect(commands.rpush).toHaveBeenCalledWith("news:comments:hello-world", expect.any(String));
    expect(commands.ltrim).toHaveBeenCalledWith("news:comments:hello-world", 0, 99);
  });

  it("reads at most 100 comments in insertion order", async () => {
    process.env.KV_REST_API_URL = "https://doc.example";
    process.env.KV_REST_API_TOKEN = "doc-token";
    commands.lrange.mockResolvedValueOnce([
      JSON.stringify({ id: "1", name: "Ada", text: "first", date: "2026-01-01T00:00:00Z" }),
      JSON.stringify({ id: "2", name: "Grace", text: "second", date: "2026-01-02T00:00:00Z" }),
    ]);
    const res = await get("hello-world");
    expect(commands.lrange).toHaveBeenCalledWith("news:comments:hello-world", 0, 99);
    const json = await res.json();
    expect(json.comments.map((c: { text: string }) => c.text)).toEqual(["first", "second"]);
  });
});
