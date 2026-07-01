import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStreamImpl = vi.fn();
const mockSetModel = vi.fn();
const mockFromConfig = vi.fn();

vi.mock("agenthood/dist/llm", () => ({
  LLMRouter: {
    fromConfig: mockFromConfig,
  },
}));

vi.mock("../app/(main)/studio/_data/agents.generated", () => ({
  agentSkills: {
    "the-scribe": "You are a commit message writer.",
  },
}));

import { LightweightAdapter } from "../app/(main)/studio/_lib/agenthood-adapter";

function collectStream(stream: ReadableStream): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];

  async function read(): Promise<string[]> {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n").filter(Boolean)) {
        events.push(line);
      }
    }
    return events;
  }
  return read();
}

async function makeStreamGen(chunks: { delta: string; done: boolean }[]) {
  async function* gen() {
    for (const c of chunks) {
      yield c;
    }
  }
  return gen();
}

function mockLLMRouter() {
  mockFromConfig.mockImplementation(async () => ({
    stream: mockStreamImpl,
    setModel: mockSetModel,
  }));
}

describe("LightweightAdapter", () => {
  let adapter: LightweightAdapter;

  beforeEach(() => {
    adapter = new LightweightAdapter();
    vi.clearAllMocks();
    mockLLMRouter();
  });

  it("accepts opencode-go as a valid provider", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([
        { delta: "Hello", done: false },
        { delta: " world", done: false },
        { delta: "", done: true },
      ]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
      config: { provider: "opencode-go", model: "deepseek-v4-flash" },
    });

    const events = await collectStream(stream);
    expect(events).toHaveLength(3);
    expect(JSON.parse(events[0])).toEqual({ type: "token", data: "Hello" });
    expect(JSON.parse(events[1])).toEqual({ type: "token", data: " world" });
    expect(JSON.parse(events[2])).toEqual({ type: "done" });
  });

  it("passes opencode-go config to LLMRouter", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "hi" }],
      config: {
        provider: "opencode-go",
        model: "deepseek-v4-flash",
        baseUrl: "https://opencode.ai/zen/go/v1",
        apiKey: "test-key",
      },
    });

    await collectStream(stream);

    const llmConfig = mockFromConfig.mock.calls[0][0];
    expect(llmConfig.providers[0]).toMatchObject({
      name: "opencode-go",
      apiKey: "test-key",
      baseUrl: "https://opencode.ai/zen/go/v1",
    });
  });

  it("falls back to groq then openai then ollama when primary is configured", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "test", done: false }, { delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
      config: { provider: "anthropic" },
    });

    await collectStream(stream);

    const llmConfig = mockFromConfig.mock.calls[0][0];
    const providerNames = llmConfig.providers.map((p: { name: string }) => p.name);
    expect(providerNames).toEqual(["anthropic", "groq", "openai", "ollama"]);
  });

  it("sets model on provider when model is specified", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "hi" }],
      config: { provider: "opencode-go", model: "deepseek-v4-pro" },
    });

    await collectStream(stream);

    expect(mockSetModel).toHaveBeenCalledWith("deepseek-v4-pro");
  });

  it("throws ValidationError for unknown provider", async () => {
    await expect(
      adapter.chat({
        agentId: "the-scribe",
        messages: [{ role: "user", content: "test" }],
        config: { provider: "nonexistent-provider" } as Record<string, unknown>,
      }),
    ).rejects.toThrow(/Unknown provider/);
  });

  it("throws ValidationError when agent skill is missing", async () => {
    await expect(
      adapter.chat({
        agentId: "unknown-agent",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow(/No system prompt/);
  });

  it("sends error event when api key is missing for key-required provider", async () => {
    mockFromConfig.mockRejectedValue(new Error("MissingApiKeyError: ANTHROPIC_API_KEY not set"));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
      config: { provider: "anthropic" },
    });

    const events = await collectStream(stream);
    expect(events).toHaveLength(1);
    const parsed = JSON.parse(events[0]);
    expect(parsed.type).toBe("error");
    expect(parsed.data).toContain("No API key configured");
  });

  it("respects abort signal and closes cleanly", async () => {
    const abortSubject = { aborted: false };
    mockStreamImpl.mockImplementation(async function* () {
      yield { delta: "partial", done: false };
      while (!abortSubject.aborted) {
        await new Promise((r) => setTimeout(r, 5));
      }
      yield { delta: "", done: true };
    });

    const controller = new AbortController();
    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    }, controller.signal);

    setTimeout(() => {
      abortSubject.aborted = true;
      controller.abort();
    }, 20);

    const events = await collectStream(stream);
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]).type).toBe("token");
  });

  it("gracefully handles provider stream errors", async () => {
    mockStreamImpl.mockRejectedValue(new Error("Provider rate limited"));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    const events = await collectStream(stream);
    expect(events).toHaveLength(1);
    const parsed = JSON.parse(events[0]);
    expect(parsed.type).toBe("error");
    expect(parsed.data).toContain("Provider rate limited");
  });
});
