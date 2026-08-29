import { describe, it, expect } from "vitest";
import { applyToolReplayOutcome } from "../app/(main)/studio/_lib/tool-outcome";
import type { Conversation } from "../app/(main)/studio/_hooks/useStudioChat";

const base: Conversation = {
  id: "conv-1",
  agentId: "the-scribe",
  title: "Tool replay",
  messages: [
    { id: "u1", role: "user", content: "check status" },
    {
      id: "a1",
      role: "assistant",
      content: "Checking.",
      toolCalls: [
        { id: "t1", name: "web_fetch", args: { url: "https://github.com/x" }, result: "ok", status: "complete" },
        { id: "t2", name: "code_execution", args: { code: "fail()" }, error: "Error: boom", status: "error", startedAt: 1000 },
      ],
    },
  ],
  config: { provider: "opencode-go", model: "deepseek-v4-flash" },
  createdAt: 0,
  tokenCount: 0,
};

describe("applyToolReplayOutcome", () => {
  it("flips a failed tool call to complete with a fresh result", () => {
    const next = applyToolReplayOutcome(base, "a1", "t2", { result: "fixed!" }, 2500, 2300);
    const message = next.messages.find((m) => m.id === "a1")!;
    const tool = message.toolCalls!.find((t) => t.id === "t2")!;
    expect(tool.status).toBe("complete");
    expect(tool.result).toBe("fixed!");
    expect(tool.error).toBeUndefined();
    expect(tool.completedAt).toBe(2500);
    expect(tool.durationMs).toBe(200);
  });

  it("keeps a failed outcome as error with the message", () => {
    const next = applyToolReplayOutcome(base, "a1", "t2", { error: "Error: still broken" }, 3000, 2800);
    const tool = next.messages[1].toolCalls!.find((t) => t.id === "t2")!;
    expect(tool.status).toBe("error");
    expect(tool.error).toBe("Error: still broken");
    expect(tool.result).toBeUndefined();
    expect(tool.durationMs).toBe(200);
  });

  it("leaves unrelated tool calls and messages untouched", () => {
    const next = applyToolReplayOutcome(base, "a1", "t2", { result: "ok" }, 5000, 4800);
    expect(next.messages[0].content).toBe("check status");
    expect(next.messages[1].toolCalls![0]).toEqual(base.messages[1].toolCalls![0]);
  });

  it("measures duration from the replay start, not the original startedAt", () => {
    const next = applyToolReplayOutcome(base, "a1", "t2", { result: "ok" }, 9000, 8800);
    const tool = next.messages[1].toolCalls!.find((t) => t.id === "t2")!;
    expect(tool.startedAt).toBe(8800);
    expect(tool.completedAt).toBe(9000);
    expect(tool.durationMs).toBe(200);
  });

  it("is a no-op when the tool call or message does not exist", () => {
    expect(applyToolReplayOutcome(base, "a1", "missing", { result: "x" })).toEqual(base);
    expect(applyToolReplayOutcome(base, "missing", "t2", { result: "x" })).toEqual(base);
  });
});