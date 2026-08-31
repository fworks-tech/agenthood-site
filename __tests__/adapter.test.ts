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

// SSE payload events only — the bridge's `log` events are orthogonal to the
// application payload and are filtered out for payload-shape assertions.
async function collectDataEvents(stream: ReadableStream): Promise<Record<string, unknown>[]> {
  const raw = await collectStream(stream);
  return raw.map((line) => JSON.parse(line)).filter((e) => (e as { type?: string }).type !== "log");
}

async function collectLogEvents(stream: ReadableStream): Promise<Record<string, unknown>[]> {
  const raw = await collectStream(stream);
  return raw.map((line) => JSON.parse(line)).filter((e) => (e as { type?: string }).type === "log");
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

    const events = await collectDataEvents(stream);
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "token", data: "Hello" });
    expect(events[1]).toEqual({ type: "token", data: " world" });
    expect(events[2]).toEqual({ type: "done" });
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

  it("accepts openrouter as a valid provider", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([
        { delta: "Hello", done: false },
        { delta: "", done: true },
      ]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
      config: { provider: "openrouter", model: "openai/gpt-4o-mini", apiKey: "test-key" },
    });

    const events = await collectDataEvents(stream);
    expect(events[0]).toEqual({ type: "token", data: "Hello" });

    const llmConfig = mockFromConfig.mock.calls[0][0];
    expect(llmConfig.providers[0]).toMatchObject({
      name: "openrouter",
      apiKey: "test-key",
    });
  });

  it("falls back via CLI priority chain when primary is configured", async () => {
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
    expect(providerNames).toEqual(['anthropic', 'opencode-go', 'opencode', 'groq', 'ollama']);
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

    const events = await collectDataEvents(stream);
    expect(events).toHaveLength(1);
    const parsed = events[0];
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const controller = new AbortController();
    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    }, controller.signal);

    setTimeout(() => {
      abortSubject.aborted = true;
      controller.abort();
    }, 20);

    const events = await collectDataEvents(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("token");
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ status: "error", source: "playground" });
  });

  it("gracefully handles provider stream errors", async () => {
    mockStreamImpl.mockRejectedValue(new Error("Provider rate limited"));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    const events = await collectDataEvents(stream);
    expect(events).toHaveLength(1);
    const parsed = events[0];
    expect(parsed.type).toBe("error");
    expect(parsed.data).toContain("Provider rate limited");
  });

  function traceLogs(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
    return spy.mock.calls
      .map((c) => JSON.parse(c[0] as string))
      .filter((e) => e.event === "trace");
  }

  it("emits a success trace with source playground and correlationId", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([
        { delta: "Hello world", done: false },
        { delta: "", done: true },
      ]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test message" }],
      config: { provider: "groq", model: "llama-3.3-70b-versatile" },
      correlationId: "corr-123",
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      source: "playground",
      member: "the-scribe",
      status: "success",
      correlationId: "corr-123",
      model: "llama-3.3-70b-versatile",
    });
    expect(traces[0].tokenCount).toMatchObject({ input: 11, output: 3, total: 14 });
    expect(typeof traces[0].cost).toBe("number");
    expect(traces[0].qualityScore).toBeNull();
  });

  it("emits an error trace when the provider fails", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockStreamImpl.mockRejectedValue(new Error("Provider rate limited"));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ status: "error", source: "playground" });
  });

  it("redacts api key patterns inside the emitted trace payload", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "ok", done: false }, { delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "use key sk-abcdefghijklmnopqrstuvwxyz012345" }],
      config: { provider: "groq", model: "llama-3.3-70b-versatile" },
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(String(traces[0].input)).not.toContain("sk-abcdefghijklmnopqrstuvwxyz012345");
  });

  it("bounds the trace payload to 8000 chars", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "ok", done: false }, { delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "x".repeat(10000) }],
      config: { provider: "groq", model: "llama-3.3-70b-versatile" },
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(String(traces[0].input).length).toBe(8000);
  });

  it("bridges sanitized log events into the SSE stream", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([
        { delta: "Hello world", done: false },
        { delta: "", done: true },
      ]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "secret content sk-abcdefghijklmnopqrstuvwxyz012345" }],
      config: { provider: "groq", model: "llama-3.3-70b-versatile" },
      correlationId: "corr-logtest",
    });

    const logs = await collectLogEvents(stream);
    const events = logs.map((l) => l.event);
    expect(events).toEqual(expect.arrayContaining(["chat.routing", "chat.complete", "trace"]));

    expect(logs[0]).toMatchObject({
      type: "log",
      level: "info",
      event: "chat.routing",
      primary: "groq",
      correlationId: "corr-logtest",
    });

    const traceLog = logs.find((l) => l.event === "trace");
    expect(traceLog).toMatchObject({
      type: "log",
      level: "info",
      event: "trace",
      source: "playground",
      member: "the-scribe",
      status: "success",
      model: "llama-3.3-70b-versatile",
    });
    expect(traceLog?.tokenCount).toMatchObject({
      input: expect.any(Number),
      output: expect.any(Number),
      total: expect.any(Number),
    });

    // Client-safe allowlist: no chat content, prompts, or api keys cross the bridge.
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("secret content");
    expect(serialized).not.toContain("sk-abcdefghijklmnopqrstuvwxyz012345");
    // The trace payload fields are dropped entirely (only tokenCount's numeric
    // input/output counters survive).
    expect(traceLog).not.toHaveProperty("input");
    expect(traceLog).not.toHaveProperty("output");
  });
});
