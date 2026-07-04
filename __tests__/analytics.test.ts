import { describe, it, expect, vi } from "vitest";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn(),
}));

describe("playground analytics events", () => {
  it("fires conversation_deleted with agentId and conversationId", async () => {
    const { track } = await import("@vercel/analytics");
    const handler = (id: string, agentId?: string) => {
      track("conversation_deleted", {
        agentId: agentId ?? "unknown",
        conversationId: id,
      });
    };
    handler("conv-123", "the-scribe");
    expect(track).toHaveBeenCalledWith("conversation_deleted", {
      agentId: "the-scribe",
      conversationId: "conv-123",
    });
  });

  it("fires conversation_deleted with unknown when no agent", async () => {
    const { track } = await import("@vercel/analytics");
    const handler = (id: string, agentId?: string) => {
      track("conversation_deleted", {
        agentId: agentId ?? "unknown",
        conversationId: id,
      });
    };
    handler("conv-456");
    expect(track).toHaveBeenCalledWith("conversation_deleted", {
      agentId: "unknown",
      conversationId: "conv-456",
    });
  });

  it("fires message_sent with conversationId", async () => {
    const { track } = await import("@vercel/analytics");
    const handler = (conversationId?: string) => {
      track("message_sent", {
        agentId: "the-scribe",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        conversationId: conversationId ?? undefined,
      });
    };
    handler("conv-789");
    expect(track).toHaveBeenCalledWith("message_sent", {
      agentId: "the-scribe",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      conversationId: "conv-789",
    });
  });

  it("fires message_completed with tokenCount", async () => {
    const { track } = await import("@vercel/analytics");
    const handler = (totalTokens: number) => {
      track("message_completed", {
        agentId: "the-scribe",
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        durationMs: 1500,
        tokenCount: totalTokens,
      });
    };
    handler(42);
    expect(track).toHaveBeenCalledWith("message_completed", {
      agentId: "the-scribe",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      durationMs: 1500,
      tokenCount: 42,
    });
  });

  it("fires config_changed with temperature and maxTokens", async () => {
    const { track } = await import("@vercel/analytics");
    const handler = (temperature: number, maxTokens: number) => {
      track("config_changed", {
        provider: "openai",
        model: "gpt-4o",
        temperature,
        maxTokens,
      });
    };
    handler(1.5, 8192);
    expect(track).toHaveBeenCalledWith("config_changed", {
      provider: "openai",
      model: "gpt-4o",
      temperature: 1.5,
      maxTokens: 8192,
    });
  });
});
