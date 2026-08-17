import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  executeTool,
  getToolSchemas,
  MAX_FETCH_SIZE,
  MAX_TOOL_ITERATIONS,
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

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getToolSchemas", () => {
  it("returns the web_fetch and code_execution tool schemas", () => {
    const schemas = getToolSchemas();
    expect(schemas.map((s) => s.name)).toEqual(["web_fetch", "code_execution"]);
    expect(schemas[0].inputSchema.required).toEqual(["url"]);
    expect(schemas[1].inputSchema.required).toEqual(["code"]);
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
    fetchMock.mockRejectedValue(new Error("aborted"));
    await expect(
      executeTool("web_fetch", { url: "https://github.com/foo" }, controller.signal),
    ).resolves.toContain("aborted");
  });
});

describe("tool constants", () => {
  it("caps tool loop iterations at 5", () => {
    expect(MAX_TOOL_ITERATIONS).toBe(5);
  });

  it("caps the fetch buffer at 100k characters", () => {
    expect(MAX_FETCH_SIZE).toBe(100_000);
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

  it("caps the returned content at 15k characters", async () => {
    fetchMock.mockResolvedValue(okResponse("abcdef".repeat(5000), "text/plain"));
    const result = await executeTool("web_fetch", { url: "https://github.com/foo" });
    expect(result).toHaveLength(15_000);
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
    await expect(executeTool("code_execution", { code: "function (" })).resolves.toContain(
      "require a function name",
    );
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
  });
});