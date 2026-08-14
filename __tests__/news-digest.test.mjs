import { describe, it, expect, vi, afterEach } from "vitest";
import {
  releasesAfter,
  newestReleaseAt,
  loadDigestState,
  buildSlug,
  validateArticle,
  listReleases,
} from "../scripts/generate-news-digest.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("news digest — release window", () => {
  const releases = [
    { tag_name: "v3.16.0", published_at: "2026-08-12T15:24:38Z" },
    { tag_name: "v3.15.0", published_at: "2026-08-12T08:28:07Z" },
    { tag_name: "v3.14.2", published_at: "2026-08-12T04:16:47Z" },
    { tag_name: "v3.13.6", published_at: "2026-08-08T23:15:17Z" },
  ];

  it("keeps releases published after the cutoff timestamp", () => {
    const result = releasesAfter(releases, "2026-08-12T04:16:47Z");
    expect(result.map((r) => r.tag_name)).toEqual(["v3.16.0", "v3.15.0"]);
  });

  it("includes same-day releases published after the cutoff (the digest-loss bug)", () => {
    const result = releasesAfter(releases, "2026-08-12T04:16:47Z");
    expect(result.some((r) => r.tag_name === "v3.15.0")).toBe(true);
  });

  it("excludes releases at or before the cutoff timestamp", () => {
    const result = releasesAfter(releases, "2026-08-12T04:16:47Z");
    expect(result.some((r) => r.tag_name === "v3.14.2")).toBe(false);
  });

  it("returns all releases when there is no cutoff", () => {
    expect(releasesAfter(releases, null)).toHaveLength(4);
  });

  it("returns nothing when every release predates the cutoff", () => {
    expect(releasesAfter(releases, "2026-08-13T00:00:00Z")).toEqual([]);
  });

  it("ignores releases without a published_at timestamp", () => {
    const dirty = [{ tag_name: "v3.14.0", published_at: null }];
    expect(releasesAfter(dirty, "2026-07-09T00:00:00Z")).toEqual([]);
  });
});

describe("news digest — digest state", () => {
  it("loads the committed lastReleaseAt state", () => {
    const state = loadDigestState();
    expect(state).toEqual({ lastReleaseAt: "2026-08-12T04:16:47Z" });
  });

  it("finds the newest release timestamp", () => {
    expect(
      newestReleaseAt([
        { tag_name: "v3.16.0", published_at: "2026-08-12T15:24:38Z" },
        { tag_name: "v3.15.0", published_at: "2026-08-12T08:28:07Z" },
        { tag_name: "v3.14.2", published_at: null },
      ]),
    ).toBe("2026-08-12T15:24:38Z");
  });

  it("returns null when no release has a timestamp", () => {
    expect(newestReleaseAt([{ tag_name: "v3.14.0", published_at: null }])).toBeNull();
  });
});

describe("news digest — slug", () => {
  it("builds a date-based slug", () => {
    expect(buildSlug("2026-08-08")).toBe("whats-new-2026-08-08.md");
  });
});

describe("news digest — article validation", () => {
  const postDate = "2026-08-08";

  const validArticle = `---
title: "Agenthood v3.13: Packaging Fixes and Faster RAG"
date: 2026-08-08
author: Agenthood Team
summary: "We shipped packaging fixes and faster RAG across v3.13.x. Here's what's new."
---

# Agenthood v3.13: Packaging Fixes and Faster RAG

**Date:** August 8, 2026  
**Author:** Agenthood Team

We've shipped several improvements across the v3.13 line.

## What Changed

- **Packaging:** scripts are now included so installs resolve cleanly.
`;

  it("accepts an article matching the contract", () => {
    const result = validateArticle(validArticle, postDate);
    expect(result.ok).toBe(true);
  });

  it("rejects a mismatched title/heading", () => {
    const bad = validArticle.replace(
      "# Agenthood v3.13: Packaging Fixes and Faster RAG",
      "# A Totally Different Title",
    );
    const result = validateArticle(bad, postDate);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("does not match");
  });

  it("rejects a summary longer than 160 characters", () => {
    const bad = validArticle.replace("summary: \"We shipped packaging fixes", "summary: \"" + "x".repeat(200));
    const result = validateArticle(bad, postDate);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("at most 160 characters");
  });

  it("rejects a date that differs from the post date", () => {
    const bad = validArticle.replace("date: 2026-08-08", "date: 2026-08-09");
    const result = validateArticle(bad, postDate);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("must be the post date");
  });

  it("rejects missing front matter", () => {
    const result = validateArticle("# No front matter here\n", postDate);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("front matter");
  });

  it("rejects missing author", () => {
    const bad = validArticle.replace("author: Agenthood Team", "author: \"\"");
    const result = validateArticle(bad, postDate);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("author");
  });
});

describe("news digest — release fetching", () => {
  function stubFetch() {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  function releasePage(items) {
    return {
      ok: true,
      status: 200,
      async json() {
        return items;
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

  function makeReleases(count, publishedAt, startTag = 0) {
    return Array.from({ length: count }, (_, i) => ({
      tag_name: `v1.0.${startTag + i}`,
      published_at: publishedAt,
    }));
  }

  it("paginates until a page contains a release at or before the cutoff", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(releasePage(makeReleases(100, "2026-08-10T00:00:00Z")))
      .mockResolvedValueOnce(releasePage([
        { tag_name: "v3.13.6", published_at: "2026-08-08T22:40:45Z" },
        { tag_name: "v3.12.0", published_at: "2026-07-09T12:00:00Z" },
      ]));

    const result = await listReleases("2026-08-08T22:40:45Z", { baseDelayMs: 1 });
    expect(result).toHaveLength(102);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches all releases when there is no cutoff", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(releasePage(makeReleases(100, "2026-01-01T00:00:00Z")))
      .mockResolvedValueOnce(releasePage(makeReleases(10, "2025-01-01T00:00:00Z")));

    const result = await listReleases(null, { baseDelayMs: 1 });
    expect(result).toHaveLength(110);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a transient 5xx from the API before succeeding", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(releasePage([{ tag_name: "v3.13.6", published_at: "2026-08-08T22:40:45Z" }]));

    const result = await listReleases(null, { baseDelayMs: 1 });
    expect(result.map((r) => r.tag_name)).toEqual(["v3.13.6"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the retry budget and surfaces the last status", async () => {
    const fetchMock = stubFetch();
    for (let i = 0; i < 4; i++) {
      fetchMock.mockResolvedValueOnce(errorResponse(503));
    }

    await expect(listReleases(null, { baseDelayMs: 1 })).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("news digest — article serialization", () => {
  it("escapes quotes in the rebuilt front matter", async () => {
    const { validateArticle, buildArticle } = await import("../scripts/generate-news-digest.mjs");
    const article = [
      '---',
      'title: "Agenthood \\"v3.14\\" Launch"',
      "date: 2026-08-08",
      'author: "A \\"quoted\\" author"',
      'summary: "Short summary"',
      "---",
      "",
      '# Agenthood "v3.14" Launch',
      "",
      "Body text.",
      "",
    ].join("\n");
    const valid = validateArticle(article, "2026-08-08");
    expect(valid.ok).toBe(true);
    const built = buildArticle("2026-08-08", valid);
    expect(built).toContain('title: "Agenthood \\"v3.14\\" Launch"');
    expect(built).toContain('author: "A \\"quoted\\" author"');
    expect(built).toContain('summary: "Short summary"');
  });
});
