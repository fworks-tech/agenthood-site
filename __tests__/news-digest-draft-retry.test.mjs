import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { generate } from "../scripts/generate-news-digest.mjs";

vi.mock("node:fs", () => {
  const readFileSync = vi.fn((file) => {
    if (String(file).endsWith(".digest-state.json")) {
      return JSON.stringify({ lastReleaseAt: "2026-08-12T04:16:47Z" });
    }
    throw new Error(`mock fs: no such file ${file}`);
  });
  const writeFileSync = vi.fn();
  const existsSync = vi.fn(() => false);
  const readdirSync = vi.fn(() => []);
  return {
    readFileSync,
    writeFileSync,
    existsSync,
    readdirSync,
    default: { readFileSync, writeFileSync, existsSync, readdirSync },
  };
});

beforeEach(() => {
  process.env.OPENCODE_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.OPENCODE_API_KEY;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("news digest — draft retry", () => {
  const postDate = "2026-08-14";
  const release = { tag_name: "v3.23.0", published_at: "2026-08-14T02:54:21Z" };
  const article = [
    "---",
    'title: "Agenthood v3.23: Test Digest"',
    "date: 2026-08-14",
    'author: "Agenthood Team"',
    'summary: "Testing the digest retry path."',
    "---",
    "",
    "# Agenthood v3.23: Test Digest",
    "",
    "Body.",
    "",
  ].join("\n");

  function releasePage() {
    return {
      ok: true,
      status: 200,
      async json() {
        return [release];
      },
    };
  }

  function chatResponse(content) {
    return {
      ok: true,
      status: 200,
      async json() {
        return content === null
          ? { choices: [] }
          : { choices: [{ message: { content } }] };
      },
    };
  }

  function errorResponse(status) {
    return {
      ok: false,
      status,
      async text() {
        return "mock error";
      },
    };
  }

  it("retries an empty article response once and writes on the second draft", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(releasePage())
      .mockResolvedValueOnce(chatResponse(null))
      .mockResolvedValueOnce(chatResponse(article));

    const result = await generate({ postDate, logger: { log() {} } });

    expect(result.status).toBe("wrote");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("whats-new-2026-08-14.md"),
      expect.stringContaining("# Agenthood v3.23: Test Digest"),
      "utf8",
    );
  });

  it("fails after two empty article responses, surfacing the response diagnostics", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(releasePage())
      .mockResolvedValueOnce(chatResponse(null))
      .mockResolvedValueOnce(chatResponse(null));

    await expect(generate({ postDate, logger: { log() {} } })).rejects.toThrow(
      /empty article \(message\.content type: undefined\)/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry draft failures that are not empty responses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(releasePage())
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(errorResponse(404));

    await expect(generate({ postDate, logger: { log() {} } })).rejects.toThrow(
      /request failed \(404\)/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
