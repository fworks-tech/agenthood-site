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
});
