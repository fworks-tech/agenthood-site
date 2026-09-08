import { describe, it, expect, vi } from "vitest";

// Test sanitize by importing and testing its effect via the exposed log function
// Since sanitize is internal to logger.ts, we test through the public logger API

describe("logger sanitization", () => {
  it("redacts apiKey fields", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("test.event", { agentId: "the-architect", apiKey: "sk-abc123" });

    const call = JSON.parse(spy.mock.calls[0][0]);
    expect(call.apiKey).toBe("[REDACTED]");
    expect(call.agentId).toBe("the-architect");

    spy.mockRestore();
  });

  it("redacts content fields", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("chat.complete", { content: "some user message", chunks: 5 });

    const call = JSON.parse(spy.mock.calls[0][0]);
    expect(call.content).toBe("[REDACTED]");

    spy.mockRestore();
  });

  it("redacts nested blocked key names", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("chat.request", { agentId: "x", token: "abc" });

    const call = JSON.parse(spy.mock.calls[0][0]);
    expect(call.token).toBe("[REDACTED]");

    spy.mockRestore();
  });

  it("passes through non-sensitive fields", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("chat.complete", { agentId: "the-architect", chunks: 42, durationMs: 1500 });

    const call = JSON.parse(spy.mock.calls[0][0]);
    expect(call.agentId).toBe("the-architect");
    expect(call.chunks).toBe(42);
    expect(call.durationMs).toBe(1500);

    spy.mockRestore();
  });

  it("redacts sensitive keys nested inside arrays bridged to the client", async () => {
    const { pickSafeLogMeta } = await import("../app/(main)/studio/_lib/logger");

    const safe = pickSafeLogMeta({ tools: [{ name: "t", apiKey: "sk-nested-secret" }] });
    const tools = safe.tools as Array<Record<string, unknown>>;

    expect(tools[0].apiKey).toBe("[REDACTED]");
    expect(tools[0].name).toBe("t");
  });

  it("redacts every occurrence of a secret pattern, not just the first", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("chat.complete", {
      reason: "tried sk-AAAAAAAAAAAAAAAAAAAA then sk-BBBBBBBBBBBBBBBBBBBB",
    });

    const call = JSON.parse(spy.mock.calls[0][0]);
    expect(call.reason).not.toContain("sk-");
    expect(call.reason).toContain("[REDACTED]");

    spy.mockRestore();
  });

  it("fails closed past the depth cap instead of leaking raw metadata", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    let deep: Record<string, unknown> = { secret: "deep-secret-value" };
    for (let i = 0; i < 8; i += 1) deep = { nested: deep } as Record<string, unknown>;
    logger.info("chat.complete", deep);

    const raw = spy.mock.calls[0][0] as string;
    expect(raw).not.toContain("deep-secret-value");

    spy.mockRestore();
  });

  it("survives circular metadata without throwing and redacts the cycle", async () => {
    const { logger } = await import("../app/(main)/studio/_lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const meta: Record<string, unknown> = { agentId: "x" };
    meta.self = meta;
    expect(() => logger.info("chat.complete", meta)).not.toThrow();

    const call = JSON.parse(spy.mock.calls[0][0]);
    expect(call.self).toBe("[REDACTED]");

    spy.mockRestore();
  });
});
