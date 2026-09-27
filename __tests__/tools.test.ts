import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  executeTool,
  getToolSchemas,
  classifyToolResult,
  MAX_TOOL_ITERATIONS,
  TOOL_RESULT_MAX_CHARS,
} from "../app/(main)/studio/_lib/tools";

function okResponse(body: string, contentType = "text/plain") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => contentType },
    text: async () => body,
  };
}

function errResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    headers: { get: () => "text/plain" },
    text: async () => "",
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getToolSchemas", () => {
  it("returns the three built-in tool schemas", () => {
    const schemas = getToolSchemas();
    expect(schemas.map((s) => s.name)).toEqual([
      "web_fetch",
      "code_execution",
      "activate_skill",
    ]);
    expect(schemas[0].inputSchema.required).toEqual(["url"]);
    expect(schemas[1].inputSchema.required).toEqual(["code"]);
    expect(schemas[2].inputSchema.required).toEqual(["skill_name"]);
  });
});

describe("activate_skill", () => {
  it("loads a packaged skill document", async () => {
    const result = await executeTool("activate_skill", { skill_name: "commit-messages" });
    expect(result).not.toMatch(/^Error: /);
    expect(result.length).toBeGreaterThan(100);
    expect(result.toLowerCase()).toContain("conventional");
  });

  it("returns an error for an unknown skill", async () => {
    await expect(executeTool("activate_skill", { skill_name: "not-a-real-skill" })).resolves.toBe(
      'Error: skill "not-a-real-skill" not found',
    );
  });

  it("rejects a missing or malformed skill_name", async () => {
    await expect(executeTool("activate_skill", {})).resolves.toMatch(/^Error: skill_name/);
    await expect(executeTool("activate_skill", { skill_name: 42 })).resolves.toMatch(
      /^Error: skill_name/,
    );
  });

  it("refuses path traversal", async () => {
    for (const bad of ["../../package", "..", "a/b", "./commit-messages", "a\\b"]) {
      const result = await executeTool("activate_skill", { skill_name: bad });
      expect(result).toMatch(/^Error: /);
    }
  });

  it("caps the returned document at the tool result limit", async () => {
    const result = await executeTool("activate_skill", { skill_name: "commit-messages" });
    expect(result.length).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);
  });
});

describe("executeTool", () => {
  it("returns an error string for an unknown tool", async () => {
    await expect(executeTool("rm_rf", {})).resolves.toBe('Error: unknown tool "rm_rf"');
  });

  it("dispatches a registered tool", async () => {
    fetchMock.mockResolvedValue(okResponse("plain text"));
    await expect(executeTool("web_fetch", { url: "https://github.com/foo" })).resolves.toBe(
      "plain text",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://github.com/foo",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("forwards the abort signal to the tool", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url, init) => {
      controller.abort();
      if (!init.signal.aborted) return Promise.resolve(okResponse("not aborted"));
      return Promise.reject(new Error("aborted"));
    });
    await expect(
      executeTool("web_fetch", { url: "https://github.com/foo" }, controller.signal),
    ).resolves.toContain("aborted");
  });
});

describe("classifyToolResult", () => {
  it("keeps success results as-is", () => {
    expect(classifyToolResult("plain content")).toEqual({ result: "plain content" });
  });

  it("splits error-prefixed results into a structured error", () => {
    expect(classifyToolResult("Error: boom")).toEqual({ error: "Error: boom" });
  });

  it("classifies the unknown-tool guard as an error", async () => {
    const result = await executeTool("nope", {});
    expect(classifyToolResult(result)).toEqual({ error: result });
  });
});

describe("tool constants", () => {
  it("caps tool loop iterations at 25", () => {
    expect(MAX_TOOL_ITERATIONS).toBe(25);
  });

  it("caps tool results at 6k characters", () => {
    expect(TOOL_RESULT_MAX_CHARS).toBe(6_000);
  });

  it("slices code_execution output to the tool result cap", async () => {
    const result = await executeTool("code_execution", { code: "'x'.repeat(20000)" });
    expect(result.length).toBeLessThanOrEqual(TOOL_RESULT_MAX_CHARS);
  });
});

describe("web_fetch URL allow-list", () => {
  it.each([
    "https://github.com/owner/repo",
    "https://raw.githubusercontent.com/owner/repo/main/file.ts",
    "https://gist.github.com/owner/abc123",
    "https://www.github.com/owner/repo",
  ])("allows %s", async (url) => {
    fetchMock.mockResolvedValue(okResponse("ok"));
    await expect(executeTool("web_fetch", { url })).resolves.toBe("ok");
  });

  it.each([
    "https://arxiv.org/pdf/2301.00001",
    "http://localhost:11434/api/tags",
    "http://127.0.0.1:3000/",
    "https://8.8.8.8/",
    "ftp://github.com/foo",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ])("rejects %s with an allow-list error", async (url) => {
    const result = await executeTool("web_fetch", { url });
    expect(result).toContain("URL not allowed");
    expect(result).toContain("github.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an error when url is missing", async () => {
    await expect(executeTool("web_fetch", {})).resolves.toBe("Error: url is required");
  });
});

describe("web_fetch response handling", () => {
  it("strips HTML, script, and style tags from HTML pages", async () => {
    const html =
      "<html><head><style>a{color:red}</style><script>alert(1)</script></head>" +
      "<body><h1>  Title </h1><p>Body text</p></body></html>";
    fetchMock.mockResolvedValue(okResponse(html, "text/html"));
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toContain("Title");
    expect(result).toContain("Body text");
    expect(result).not.toContain("<style>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
  });

  it("returns raw text for non-HTML responses", async () => {
    fetchMock.mockResolvedValue(okResponse("raw markdown **content**", "text/plain"));
    await expect(executeTool("web_fetch", { url: "https://raw.githubusercontent.com/x/y" })).resolves.toBe(
      "raw markdown **content**",
    );
  });

  it("caps the returned content at TOOL_RESULT_MAX_CHARS", async () => {
    fetchMock.mockResolvedValue(okResponse("abcdef".repeat(5000), "text/plain"));
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toHaveLength(TOOL_RESULT_MAX_CHARS);
  });

  it("retries once on 5xx and returns the recovered body", async () => {
    fetchMock
      .mockResolvedValueOnce(errResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(okResponse("recovered"));
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the error after a second consecutive 5xx", async () => {
    fetchMock.mockResolvedValue(errResponse(503, "Service Unavailable"));
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toBe("Error: HTTP 503 Service Unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx", async () => {
    fetchMock.mockResolvedValue(errResponse(404, "Not Found"));
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toBe("Error: HTTP 404 Not Found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an HTTP error message for non-ok responses", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: { get: () => "text/plain" },
    });
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toBe("Error: HTTP 404 Not Found");
  });

  it("returns a friendly error when the fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    await expect(executeTool("web_fetch", { url: "https://github.com/foo" })).resolves.toContain(
      "ENOTFOUND",
    );
  });
});

describe("code_execution sandbox", () => {
  it("returns an error when code is missing", async () => {
    await expect(executeTool("code_execution", {})).resolves.toBe("Error: code is required");
  });

  it("returns the stringified result for numeric results", async () => {
    await expect(executeTool("code_execution", { code: "1 + 1" })).resolves.toBe("2");
  });

  it("returns strings verbatim", async () => {
    await expect(executeTool("code_execution", { code: "'hello world'" })).resolves.toBe(
      "hello world",
    );
  });

  it("pretty-prints object results", async () => {
    await expect(
      executeTool("code_execution", { code: "({ a: 1 })" }),
    ).resolves.toBe('{\n  "a": 1\n}');
  });

  it("reports undefined results as executed successfully", async () => {
    await expect(executeTool("code_execution", { code: "const x = 1;" })).resolves.toBe(
      "Executed successfully (undefined result)",
    );
  });

  it("surfaces syntax errors", async () => {
    const result = await executeTool("code_execution", { code: "function (" });
    expect(result).toMatch(/^Error: /);
    expect(result).not.toContain("Executed successfully");
  });

  it("surfaces runtime errors", async () => {
    await expect(
      executeTool("code_execution", { code: "throw new Error('boom')" }),
    ).resolves.toContain("boom");
  });

  it("denies access to Node globals outside the sandbox", async () => {
    await expect(executeTool("code_execution", { code: "process.version" })).resolves.toContain(
      "process is not defined",
    );
    await expect(executeTool("code_execution", { code: "typeof require" })).resolves.toBe(
      "undefined",
    );
  });

  // The escape that actually worked: a bare createContext({}) contextifies a
  // HOST-realm object, so a constructor chain reached the real `process` and
  // exfiltrated process.env through the tool result. One vector per mechanism.
  it.each([
    ["prototype chain", "this.constructor.constructor('return typeof process')()"],
    ["Reflect.construct", "Reflect.construct(Function, ['return typeof process'])()"],
    ["indirect eval", "(0, eval)('typeof process')"],
  ])("blocks host-realm escape via %s", async (_name, code) => {
    const result = await executeTool("code_execution", { code });
    expect(result).not.toContain("object");
  });

  it("does not leak process.env through a constructor chain", async () => {
    const result = await executeTool("code_execution", {
      code: "(() => { const p = this.constructor.constructor('return process')(); return JSON.stringify(p.env); })()",
    });
    expect(result).not.toContain("PATH");
    expect(result).not.toContain("API_KEY");
  });

  // The hardening must not cost real capability.
  it("still runs ordinary JavaScript after hardening", async () => {
    await expect(
      executeTool("code_execution", {
        code: "class A { constructor() { this.x = 1 } } class B extends A { constructor() { super(); this.y = 2 } } JSON.stringify(new B())",
      }),
    ).resolves.toBe('{"x":1,"y":2}');
    await expect(
      executeTool("code_execution", { code: "const f = (n) => (n <= 1 ? 1 : n * f(n - 1)); f(5)" }),
    ).resolves.toBe("120");
  });
});