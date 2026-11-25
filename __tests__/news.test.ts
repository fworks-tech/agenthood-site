import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildNewsManifest, isIsoDate, shouldWriteManifest } from "../scripts/build-news-manifest.mjs";

const MANIFEST_PATH = path.join(process.cwd(), "content", "news", "manifest.json");

interface NewsEntry {
  slug: string[];
  path: string;
  title: string;
  date: string;
  author?: string;
  summary?: string;
}

function readManifest(): NewsEntry[] {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as NewsEntry[];
  } catch {
    return [];
  }
}

describe("news manifest", () => {
  it("matches what the generator produces from article front matter", () => {
    const generated = buildNewsManifest();
    expect(readManifest()).toEqual(generated);
  });

  it("is sorted by date descending", () => {
    const manifest = readManifest();
    for (let i = 1; i < manifest.length; i++) {
      expect(manifest[i - 1].date >= manifest[i].date).toBe(true);
    }
  });

  it("parses and returns entries with required fields", () => {
    const manifest = readManifest();
    const newsDir = path.join(process.cwd(), "content", "news");
    const filesOnDisk = fs
      .readdirSync(newsDir)
      .filter((f) => f.endsWith(".md"));
    expect(manifest.length).toBe(filesOnDisk.length);

    for (const entry of manifest) {
      expect(entry).toHaveProperty("slug");
      expect(Array.isArray(entry.slug)).toBe(true);
      expect(entry.slug.length).toBeGreaterThan(0);
      expect(entry).toHaveProperty("path");
      expect(entry).toHaveProperty("title");
      expect(entry).toHaveProperty("date");
    }
  });

  it("each entry's file exists on disk", () => {
    const manifest = readManifest();
    const cwd = process.cwd();

    for (const entry of manifest) {
      const filePath = path.join(cwd, "content", entry.path);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it("each article has an H1 matching its front matter title", () => {
    for (const entry of readManifest()) {
      const text = fs.readFileSync(path.join(process.cwd(), "content", entry.path), "utf8");
      const heading = text.split("\n").find((l) => l.trim().startsWith("# "));
      expect(heading?.trim().replace(/^#\s+/, ""), entry.path).toBe(entry.title);
    }
  });

  it("entries have valid ISO date strings", () => {
    const manifest = readManifest();

    for (const entry of manifest) {
      const parsed = new Date(entry.date);
      expect(parsed.getTime()).not.toBeNaN();
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("RSS feed", () => {
  it("generates valid RSS XML with items", async () => {
    const { GET } = await import("../app/(main)/news/rss.xml/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('<?xml version="1.0"');
    expect(text).toContain("<rss version=\"2.0\"");
    expect(text).toContain("<channel>");
    expect(text).toContain("<item>");
    expect(text).toContain("<title>");
    expect(text).toContain("</rss>");

    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("application/rss+xml");
  });

  it("includes all manifest entries as items", async () => {
    const manifest = readManifest();
    const { GET } = await import("../app/(main)/news/rss.xml/route");
    const res = await GET();
    const text = await res.text();

    for (const entry of manifest) {
      const encoded = entry.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      expect(text).toContain(encoded);
    }
  });

  it("escapes every slug segment in both link and guid", async () => {
    const { buildRssItem } = await import("../app/(main)/news/rss.xml/route");
    const xml = buildRssItem({
      slug: ["a&b", "<script>"],
      path: "news/a&b/<script>.md",
      title: "Unsafe slugs",
      date: "2026-01-01",
    });

    expect(xml).toContain("news/a&amp;b/&lt;script&gt;</link>");
    expect(xml).toContain("news/a&amp;b/&lt;script&gt;</guid>");
    expect(xml).not.toContain("news/a&b/<script>");
  });
});

describe("news manifest — ISO date validation", () => {
  it("accepts a real calendar date", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
  });

  it("rejects an impossible date such as 2026-02-30", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
  });
});

describe("news automation safety", () => {
  it("passes the generator output to the PR step via env instead of inline interpolation", () => {
    const yaml = fs.readFileSync(path.join(process.cwd(), ".github/workflows/news-digest.yml"), "utf8");
    expect(yaml).toContain("DIGEST_RESULT: ${{ steps.generate.outputs.result }}");
    expect(yaml).toContain('echo "$DIGEST_RESULT"');
    expect(yaml).not.toContain('echo "${{ steps.generate.outputs.result }}"');
  });

  it("does not rewrite the tracked manifest in lenient mode when an article was skipped", () => {
    expect(shouldWriteManifest(true, 4, 4)).toBe(true);
    expect(shouldWriteManifest(true, 3, 4)).toBe(false);
    expect(shouldWriteManifest(false, 3, 4)).toBe(true);
  });
});
