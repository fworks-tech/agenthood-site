import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReadableStream } from "node:stream/web";

const { chatMock, captureSpy } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  captureSpy: vi.fn(),
}));

vi.mock("@/app/(main)/studio/_lib/agenthood-adapter", () => ({
  LightweightAdapter: class {
    chat = chatMock;
  },
}));

vi.mock("@sentry/nextjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/nextjs")>();
  return { ...actual, captureException: captureSpy };
});

const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  chatMock.mockReset();
  captureSpy.mockReset();
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

const VALID_BODY = {
  agentId: "the-scribe",
  messages: [{ role: "user", content: "hello" }],
  config: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
};

function streamWith(...lines: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(line + "\n"));
      }
      controller.close();
    },
  });
}

async function postRoute(body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import("../app/api/studio/chat/route");
  return POST(
    new Request("http://localhost/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function expectValidationError(
  body: Record<string, unknown>,
  messagePart: string,
): Promise<void> {
  const res = await postRoute(body);
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.error).toContain(messagePart);
}

describe("chat route validation", () => {
  it("rejects non-JSON request bodies", async () => {
    const { POST } = await import("../app/api/studio/chat/route");
    const res = await POST(
      new Request("http://localhost/api/studio/chat", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("valid JSON");
  });

  it("rejects bodies that are not objects", async () => {
    await expectValidationError([] as unknown as Record<string, unknown>, "JSON object");
  });

  it("rejects a missing agentId", async () => {
    const { agentId, ...rest } = VALID_BODY;
    expect(agentId).toBe("the-scribe");
    await expectValidationError(rest, "agentId must be a string");
  });

  it("rejects a non-string agentId", async () => {
    await expectValidationError({ ...VALID_BODY, agentId: 42 }, "agentId must be a string");
  });

  it("rejects an unknown agent", async () => {
    await expectValidationError(
      { ...VALID_BODY, agentId: "not-a-member" },
      'Unknown agent: "not-a-member"',
    );
  });

  it("rejects messages that are not an array", async () => {
    await expectValidationError({ ...VALID_BODY, messages: "hello" }, "messages must be an array");
  });

  it("rejects empty message arrays", async () => {
    await expectValidationError({ ...VALID_BODY, messages: [] }, "must not be empty");
  });

  it("rejects more than 50 messages", async () => {
    await expectValidationError(
      { ...VALID_BODY, messages: Array.from({ length: 51 }, () => ({ role: "user", content: "x" })) },
      "must not exceed 50",
    );
  });

  it("rejects messages missing a role string", async () => {
    await expectValidationError(
      { ...VALID_BODY, messages: [{ role: "", content: "x" }] },
      "role string",
    );
  });

  it("rejects messages with non-string content", async () => {
    await expectValidationError(
      { ...VALID_BODY, messages: [{ role: "user", content: 5 }] },
      "content string",
    );
  });

  it("rejects individual messages over 4000 characters", async () => {
    await expectValidationError(
      { ...VALID_BODY, messages: [{ role: "user", content: "x".repeat(4001) }] },
      "4000 characters",
    );
  });

  it("rejects total message content over 100k characters", async () => {
    const messages = Array.from({ length: 50 }, () => ({ role: "user", content: "x".repeat(2001) }));
    await expectValidationError({ ...VALID_BODY, messages }, "100000 characters");
  });

  it("rejects an unknown provider", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "gptchat" } },
      'Unknown provider: "gptchat"',
    );
  });

  it("rejects an unknown model for a known provider", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "anthropic", model: "claude-nonexistent" } },
      'Unknown model "claude-nonexistent"',
    );
  });

  it("rejects a model that does not belong to the selected provider", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "openai", model: "claude-sonnet-4-20250514" } },
      'Unknown model "claude-sonnet-4-20250514" for provider "openai"',
    );
  });

  it("rejects any model for a provider with no listed models", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "openrouter", model: "claude-sonnet-4-20250514" } },
      'Unknown model "claude-sonnet-4-20250514"',
    );
  });

  it("rejects temperature outside the 0-2 range by dropping it silently", async () => {
    chatMock.mockResolvedValue(streamWith('{"type":"done"}'));
    const res = await postRoute({
      ...VALID_BODY,
      config: { provider: "anthropic", model: "claude-sonnet-4-20250514", temperature: 5 },
    });
    expect(res.status).toBe(200);
    expect(chatMock.mock.calls[0][0].config).not.toHaveProperty("temperature");
  });

  it("rejects maxTokens above 100k by dropping it silently", async () => {
    chatMock.mockResolvedValue(streamWith('{"type":"done"}'));
    const res = await postRoute({
      ...VALID_BODY,
      config: { provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 200_000 },
    });
    expect(res.status).toBe(200);
    expect(chatMock.mock.calls[0][0].config).not.toHaveProperty("maxTokens");
  });
});

describe("chat route baseUrl validation", () => {
  it("rejects a baseUrl for cloud providers", async () => {
    await expectValidationError(
      {
        ...VALID_BODY,
        config: { provider: "anthropic", model: "claude-sonnet-4-20250514", baseUrl: "https://api.anthropic.com" },
      },
      "baseUrl is not supported",
    );
  });

  it("rejects an invalid baseUrl format", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "ollama", model: "llama3.2", baseUrl: "not-a-url" } },
      "Invalid baseUrl format",
    );
  });

  it("rejects non-http baseUrl protocols", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "ollama", model: "llama3.2", baseUrl: "file:///etc/passwd" } },
      "http or https protocol",
    );
  });

  it("rejects an http baseUrl for non-local hosts", async () => {
    await expectValidationError(
      { ...VALID_BODY, config: { provider: "ollama", model: "llama3.2", baseUrl: "http://evil.example:11434" } },
      "only allowed for localhost",
    );
  });

  it("accepts an http baseUrl for localhost hosts", async () => {
    chatMock.mockResolvedValue(streamWith('{"type":"done"}'));
    const res = await postRoute({
      ...VALID_BODY,
      config: {
        provider: "ollama",
        model: "llama3.2",
        baseUrl: "http://127.0.0.1:11434",
        temperature: 0.5,
        maxTokens: 512,
      },
    });
    expect(res.status).toBe(200);
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: "http://127.0.0.1:11434",
          temperature: 0.5,
          maxTokens: 512,
        }),
      }),
      expect.anything(),
    );
  });
});

describe("chat route streaming response", () => {
  it("returns an SSE response with correlation and request headers", async () => {
    chatMock.mockResolvedValue(streamWith('{"type":"token","data":"hi"}', '{"type":"done"}'));

    const { POST } = await import("../app/api/studio/chat/route");
    const res = await POST(
      new Request("http://localhost/api/studio/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": "corr-1",
        },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    expect(res.headers.get("X-Correlation-Id")).toBe("corr-1");
  });

  it("surfaces adapter failures as a 500 with a generic message", async () => {
    chatMock.mockRejectedValue(new Error("no api key configured"));

    const res = await postRoute(VALID_BODY);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.code).toBe("INTERNAL_ERROR");
    expect(json.error).toBe("Internal server error");
    expect(captureSpy).toHaveBeenCalledTimes(1);
  });
});