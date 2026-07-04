import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

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
  it("parses and returns entries with required fields", () => {
    const manifest = readManifest();
    expect(manifest.length).toBe(4);
    expect(manifest[0].title).toBe("Feedback API, News Section, and Observability Improvements");

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
});
