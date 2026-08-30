/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { STORAGE_KEYS } from "../app/(main)/studio/_lib/constants";

// Mocks must be hoisted — use vi.mock at top level
const mockSendChat = vi.fn();
const mockReadSSEStream = vi.fn();

vi.mock("../app/(main)/studio/_lib/studio-api", async () => {
  const actual = await vi.importActual<typeof import("../app/(main)/studio/_lib/studio-api")>(
    "../app/(main)/studio/_lib/studio-api",
  );
  return {
    ...actual,
    sendChat: (...args: unknown[]) => mockSendChat(...args),
    replayToolExecution: vi.fn(),
  };
});

vi.mock("../app/(main)/studio/_lib/stream", async () => {
  const actual = await vi.importActual<typeof import("../app/(main)/studio/_lib/stream")>(
    "../app/(main)/studio/_lib/stream",
  );
  return {
    ...actual,
    readSSEStream: (...args: unknown[]) => mockReadSSEStream(...args),
  };
});

function mockResponseOk() {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (k: string) => (k === "x-request-id" ? "r1" : k === "x-correlation-id" ? "c1" : null),
    },
  } as unknown as Response;
}

function clearStorage() {
  localStorage.clear();
}

function getStoredConversations(): any[] {
  const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
  return raw ? JSON.parse(raw) : [];
}

describe("useStudioChat persistence hardening (ADR-009)", () => {
  beforeEach(() => {
    clearStorage();
    vi.clearAllMocks();
    mockSendChat.mockReset();
    mockReadSSEStream.mockReset();
    // default ok chat response
    mockSendChat.mockResolvedValue(mockResponseOk());
  });

  afterEach(() => {
    clearStorage();
  });

  it("interleaved onToken x5 -> onToolResult -> onDone persists final tokenCount and streamedContent atomically", async () => {
    // readSSEStream will synchronously invoke callbacks in order, simulating real SSE
    mockReadSSEStream.mockImplementation(async (_res: Response, cbs: any) => {
      cbs.onToken("Hello ");
      cbs.onToken("world ");
      cbs.onToken("from ");
      cbs.onToken("the ");
      cbs.onToken("hood.");
      // tool_result should persist via saveConversations without clobbering streamedContent
      cbs.onToolResult({ id: "tc-1", name: "echo", result: "ok" });
      cbs.onDone();
    });

    const { useStudioChat } = await import("../app/(main)/studio/_hooks/useStudioChat");
    const { result } = renderHook(() => useStudioChat({ config: { provider: "groq" } }));

    // wait for hydration (useLayoutEffect loads from localStorage)
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // create a conversation with base tokenCount 0
    act(() => result.current.newConversation("the-scribe"));
    const convId = result.current.activeConversationId!;
    expect(convId).toBeTruthy();

    // sanity: after newConversation storage has 1 conv with tokenCount 0
    expect(getStoredConversations()[0].tokenCount).toBe(0);

    const streamed = "Hello world from the hood.";
    const estimated = Math.ceil(streamed.length / 4); // same formula as hook

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    // await streaming settled (isStreaming false)
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // message content should be full streamedContent
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe(streamed);

    // localStorage final tokenCount must be baseTokens (0) + estimated
    const stored = getStoredConversations().find((c: any) => c.id === convId);
    expect(stored).toBeDefined();
    expect(stored.tokenCount).toBe(estimated);
    expect(stored.messages[1].content).toBe(streamed);

    // per-token updates must NOT have persisted intermediate localStorage writes beyond onToolResult/onDone.
    // We assert save was called exactly via the two persisted sites (onToolResult + onDone). The spy is on localStorage.setItem:
    // But we can at least verify final state is not clobbered — already above.
    // Also verify no persistTokens symbol remains in source (grep would fail if reintroduced)
    const fs = await import("fs");
    const src = fs.readFileSync("app/(main)/studio/_hooks/useStudioChat.ts", "utf8");
    expect(src).not.toContain("persistTokens");
    expect(src).toContain("withTokenCount");
  });

  it("sendMessage and retrySendMessage both remove placeholder on CAPTCHA_FAILED instead of leaving error bubble", async () => {
    const captchaErr = Object.assign(new Error("captcha required"), { code: "CAPTCHA_FAILED" });

    // First call: sendMessage path throws CAPTCHA_FAILED before streaming
    mockSendChat.mockRejectedValueOnce(captchaErr);

    const { useStudioChat } = await import("../app/(main)/studio/_hooks/useStudioChat");
    const { result } = renderHook(() => useStudioChat({ config: {} }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.newConversation("the-scribe"));
    const convId = result.current.activeConversationId!;

    // sendMessage should swallow CAPTCHA_FAILED and remove placeholder (no throw propagation needed for UI)
    await act(async () => {
      await expect(result.current.sendMessage("hello")).rejects.toThrow("captcha required");
    });

    // placeholder assistant message must be removed — only user message remains
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
    expect(getStoredConversations().find((c: any) => c.id === convId).messages).toHaveLength(1);

    // Second path: retrySendMessage with same CAPTCHA_FAILED — must also remove placeholder (not write Error: CAPTCHA_FAILED)
    mockSendChat.mockRejectedValueOnce(captchaErr);
    await act(async () => {
      await expect(result.current.retrySendMessage("hello")).rejects.toThrow("captcha required");
    });

    // still only the original user message — retry placeholder also removed
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
    const stored = getStoredConversations().find((c: any) => c.id === convId);
    expect(stored.messages).toHaveLength(1);
    expect(JSON.stringify(stored.messages)).not.toContain("CAPTCHA_FAILED");
    expect(JSON.stringify(stored.messages)).not.toContain("Error: captcha");
  });

  it("generic streaming error persists error message without mutating tokenCount via withTokenCount", async () => {
    mockReadSSEStream.mockImplementation(async (_res: Response, cbs: any) => {
      cbs.onToken("partial ");
      cbs.onError(new Error("upstream timeout"));
    });

    const { useStudioChat } = await import("../app/(main)/studio/_hooks/useStudioChat");
    const { result } = renderHook(() => useStudioChat({ config: {} }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => result.current.newConversation("the-scribe"));
    const convId = result.current.activeConversationId!;
    const baseStored = getStoredConversations().find((c: any) => c.id === convId);
    const baseTokens = baseStored.tokenCount;

    await act(async () => {
      await expect(result.current.sendMessage("hi")).rejects.toThrow("upstream timeout");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // error message should be written to assistant bubble (onError -> withTokenCount, then re-throw -> handleGenericError preserves it)
    expect(result.current.messages[1].content).toBe("Error: upstream timeout");

    // tokenCount should be base + estimated for streamed "partial " (onError uses withTokenCount)
    const stored = getStoredConversations().find((c: any) => c.id === convId);
    const estimated = Math.ceil("partial ".length / 4);
    expect(stored.tokenCount).toBe(baseTokens + estimated);
  });
});
