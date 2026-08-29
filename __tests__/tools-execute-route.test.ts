import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { captureSpy } = vi.hoisted(() => ({ captureSpy: vi.fn() }));

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
  captureSpy.mockReset();
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

const URL = "https://agenthood.flabs.tech/api/studio/tools/execute/";

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/studio/tools/execute/route");
  return POST(
    new Request(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Correlation-Id": "test-corr" },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/studio/tools/execute", () => {
  it("executes code_execution and returns the result", async () => {
    const res = await post({ tool: "code_execution", args: { code: "1 + 1" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe("2");
    expect(data.error).toBeUndefined();
  });

  it("classifies a failing tool as a structured error", async () => {
    const res = await post({ tool: "code_execution", args: { code: "throw new Error('boom')" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBeUndefined();
    expect(data.error).toContain("boom");
  });

  it("rejects an unknown tool with 400 VALIDATION_ERROR", async () => {
    const res = await post({ tool: "rm_rf", args: {} });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non-object args with 400", async () => {
    const res = await post({ tool: "code_execution", args: null });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("rejects a non-JSON body", async () => {
    const { POST } = await import("@/app/api/studio/tools/execute/route");
    const res = await POST(new Request(URL, { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });
});