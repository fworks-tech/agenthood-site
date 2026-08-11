import { describe, it, expect } from "vitest";
import { releasesAfterDate, buildSlug, validateArticle } from "../scripts/generate-news-digest.mjs";

describe("news digest — release window", () => {
  const releases = [
    { tag_name: "v3.13.6", published_at: "2026-08-08T23:15:17Z" },
    { tag_name: "v3.13.5", published_at: "2026-08-08T22:40:45Z" },
    { tag_name: "v3.12.0", published_at: "2026-07-09T12:00:00Z" },
    { tag_name: "v3.11.0", published_at: "2026-07-07T10:00:00Z" },
  ];

  it("keeps releases published after the cutoff date", () => {
    const result = releasesAfterDate(releases, "2026-07-09");
    expect(result.map((r) => r.tag_name)).toEqual(["v3.13.6", "v3.13.5"]);
  });

  it("excludes releases published on the cutoff day (already covered)", () => {
    const result = releasesAfterDate(releases, "2026-07-09");
    expect(result.some((r) => r.tag_name === "v3.12.0")).toBe(false);
  });

  it("returns all releases when there is no cutoff", () => {
    expect(releasesAfterDate(releases, null)).toHaveLength(4);
  });

  it("returns nothing when every release is older than the cutoff", () => {
    expect(releasesAfterDate(releases, "2026-08-09")).toEqual([]);
  });

  it("ignores releases without a published_at date", () => {
    const dirty = [{ tag_name: "v3.14.0", published_at: null }];
    expect(releasesAfterDate(dirty, "2026-07-09")).toEqual([]);
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
