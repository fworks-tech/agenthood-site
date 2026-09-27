import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockStreamImpl,
  mockSetModel,
  mockFromConfig,
  mockGetToolSchemas,
  mockExecuteTool,
} = vi.hoisted(() => ({
  mockStreamImpl: vi.fn(),
  mockSetModel: vi.fn(),
  mockFromConfig: vi.fn(),
  mockGetToolSchemas: vi.fn(),
  mockExecuteTool: vi.fn(),
}));

vi.mock("agenthood/dist/llm", () => ({
  LLMRouter: {
    fromConfig: mockFromConfig,
  },
}));

vi.mock("../app/(main)/studio/_data/agents.generated", () => ({
  agentSkills: {
    "the-scribe": "You are a commit message writer.",
  },
  sharedConversationalStyle: "",
  toolSkills: [],
}));

vi.mock("../app/(main)/studio/_data/registry.generated", () => ({
  agentRegistry: [
    { name: "the-scribe", displayName: "The Scribe", tagline: "", role: "commits", stage: [], priority: 0 },
  ],
}));

vi.mock("../app/(main)/studio/_lib/tools", () => ({
  getToolSchemas: mockGetToolSchemas,
  executeTool: mockExecuteTool,
  MAX_TOOL_ITERATIONS: 25,
  classifyToolResult: (result: string) =>
    /^Error: /.test(result) ? { error: result } : { result },
}));

import { LightweightAdapter } from "../app/(main)/studio/_lib/agenthood-adapter";
import {
  DEMO_CODE_MODEL,
  DEMO_MAX_TOKENS,
  DEMO_MODEL,
  DEMO_QA_MODEL,
  selectDemoModel,
} from "../app/(main)/studio/_types/studio";

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
    mockGetToolSchemas.mockReset();
    mockExecuteTool.mockReset();
  });

  it("pins the demo provider and model regardless of what the client sends", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "hi" }],
      // The route drops these, but the adapter must not honour them either.
      config: { provider: "openai", model: "gpt-4o", apiKey: "sk-leak" } as never,
    });

    await collectStream(stream);

    const llmConfig = mockFromConfig.mock.calls[0][0];
    expect(llmConfig.providers[0]).toEqual({ name: "opencode" });
    expect(llmConfig.providers[0]).not.toHaveProperty("apiKey");
    expect(llmConfig.providers[0]).not.toHaveProperty("baseUrl");
    // plain Q&A with no tools routes to the cheapest tier
    expect(mockSetModel).toHaveBeenCalledWith("gpt-6-luna");
  });

  it("caps output tokens so a request cannot run unbounded", async () => {
    mockStreamImpl.mockImplementation(async () => makeStreamGen([{ delta: "", done: true }]));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "hi" }],
    });
    await collectStream(stream);

    expect(mockStreamImpl.mock.calls[0][0].maxTokens).toBe(DEMO_MAX_TOKENS);
  });

  it("uses the single demo provider (no fallback)", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "test", done: false }, { delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    await collectStream(stream);

    const llmConfig = mockFromConfig.mock.calls[0][0];
    const providerNames = llmConfig.providers.map((p: { name: string }) => p.name);
    expect(providerNames).toEqual(['opencode']);
  });

  it("throws ValidationError when agent skill is missing", async () => {
    await expect(
      adapter.chat({
        agentId: "unknown-agent",
        messages: [{ role: "user", content: "test" }],
      }),
    ).rejects.toThrow(/No system prompt/);
  });

  it("sends error event when the server has no API key", async () => {
    mockFromConfig.mockRejectedValue(new Error("MissingApiKeyError: OPENCODE_API_KEY not set"));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    const events = await collectDataEvents(stream);
    expect(events).toHaveLength(1);
    const parsed = events[0];
    expect(parsed.type).toBe("error");
    expect(parsed.data).toContain("no API key configured on the server");
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
      .map((c: unknown[]) => JSON.parse(c[0] as string))
      .filter((e: Record<string, unknown>) => e.event === "trace");
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
      model: "gpt-6-luna",
    });
    const tokenCount = traces[0].tokenCount as { input: number; total: number };
    expect(tokenCount.input).toBeGreaterThan(11);
    expect(tokenCount.total).toBe(tokenCount.input + 3);
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
      correlationId: "corr-logtest",
    });

    const logs = await collectLogEvents(stream);
    const events = logs.map((l) => l.event);
    expect(events).toEqual(expect.arrayContaining(["chat.routing", "chat.complete", "trace"]));

    expect(logs[0]).toMatchObject({
      type: "log",
      level: "info",
      event: "chat.routing",
      primary: "opencode",
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
      model: "gpt-6-luna",
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

  it("emits a success trace with output = finalText after tool loop", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockGetToolSchemas.mockReturnValue([
      { name: "code_execution", description: "Run code", parameters: { type: "object", properties: {} } },
    ]);
    mockExecuteTool.mockResolvedValue("tool output done");
    mockFromConfig.mockImplementation(async () => ({
      stream: mockStreamImpl,
      setModel: mockSetModel,
      complete: vi.fn().mockResolvedValueOnce({
        content: "",
        toolCalls: [{ id: "tc-1", name: "code_execution", args: { code: "1+1" } }],
      }).mockResolvedValueOnce({
        content: "The answer is 2.",
        toolCalls: undefined,
      }),
    }));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "what is 1+1?" }],
      config: { enabledTools: ["code_execution"] },
      correlationId: "corr-tool-1",
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      status: "success",
      source: "playground",
      correlationId: "corr-tool-1",
      output: "The answer is 2.",
    });
  });

  it("streams tool_call and tool_result live during the tool loop", async () => {
    mockGetToolSchemas.mockReturnValue([
      { name: "code_execution", description: "Run code", parameters: { type: "object", properties: {} } },
    ]);
    mockExecuteTool.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return "tool output done";
    });
    mockFromConfig.mockImplementation(async () => ({
      stream: mockStreamImpl,
      setModel: mockSetModel,
      complete: vi.fn().mockResolvedValueOnce({
        content: "",
        toolCalls: [{ id: "tc-1", name: "code_execution", args: { code: "1+1" } }],
      }).mockResolvedValueOnce({
        content: "The answer is 2.",
        toolCalls: undefined,
      }),
    }));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "what is 1+1?" }],
      config: { enabledTools: ["code_execution"] },
    });

    const events = await collectDataEvents(stream);
    const types = events.map((e) => e.type);
    expect(types.slice(0, 2)).toEqual(["tool_call", "tool_result"]);
    expect(types[types.length - 1]).toBe("done");
    expect(events[0]).toMatchObject({ id: "tc-1", name: "code_execution", args: { code: "1+1" } });
    expect(events[1]).toMatchObject({ id: "tc-1", result: "tool output done" });
    const tokens = events.filter((e) => e.type === "token").map((e) => (e as { data: string }).data).join("");
    expect(tokens).toBe("The answer is 2.");
  });

  it("emits exactly one trace event for a successful plain-stream call", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "Hello", done: false }, { delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(traces[0].status).toBe("success");
  });

  it("emits exactly one trace event when the provider errors", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockStreamImpl.mockRejectedValue(new Error("Provider exploded"));

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "test" }],
    });

    await collectStream(stream);
    const traces = traceLogs(consoleSpy);
    consoleSpy.mockRestore();

    expect(traces).toHaveLength(1);
    expect(traces[0].status).toBe("error");
  });

  it("routes tool-enabled requests to the default tier", async () => {
    mockGetToolSchemas.mockReturnValue([]);
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "hi" }],
      config: { enabledTools: ["web_fetch"] },
    });
    await collectStream(stream);

    expect(mockSetModel).toHaveBeenCalledWith(DEMO_MODEL);
  });

  it("routes code-fenced prompts to the code tier", async () => {
    mockStreamImpl.mockImplementation(async () =>
      makeStreamGen([{ delta: "", done: true }]),
    );

    const stream = await adapter.chat({
      agentId: "the-scribe",
      messages: [{ role: "user", content: "fix this:\n```ts\nconst x = 1\n```" }],
    });
    await collectStream(stream);

    expect(mockSetModel).toHaveBeenCalledWith(DEMO_CODE_MODEL);
  });
});

describe("selectDemoModel", () => {
  const msg = (content: string) => [{ content }];

  it("picks the Q&A tier for plain prompts with no tools", () => {
    expect(selectDemoModel("the-scribe", msg("what is an ADR?"), false)).toBe(DEMO_QA_MODEL);
  });

  it("picks the default tier when tools are on", () => {
    expect(selectDemoModel("the-scribe", msg("what is an ADR?"), true)).toBe(DEMO_MODEL);
  });

  it.each(["the-tester", "the-debugger"])("picks the code tier for code agent %s", (agent) => {
    expect(selectDemoModel(agent, msg("plain question"), false)).toBe(DEMO_CODE_MODEL);
  });

  it("picks the code tier for fenced code from any agent", () => {
    expect(selectDemoModel("the-scribe", msg("explain ```ts\nx()\n```"), false)).toBe(DEMO_CODE_MODEL);
  });
});
