import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { upsertSummary } from "../scripts/summarize-news.mjs";

function article(frontMatter, body = "\n# Title\n\nBody.\n") {
  return `---\n${frontMatter}\n---\n${body}`;
}

function withArticle(frontMatter) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "summarize-news-"));
  const file = path.join(dir, "article.md");
  fs.writeFileSync(file, article(frontMatter).replace(/\n/g, "\r\n"), "utf8");
  return { dir, file };
}

function readFrontMatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  return { text, data: parseYaml(match[1]) };
}

describe("summarize-news — upsertSummary", () => {
  it("replaces a summary that is the first front matter field", () => {
    const { dir, file } = withArticle('summary: "old"\ntitle: "Title"\nauthor: "Team"');
    try {
      upsertSummary(file, 'new "quoted" summary');
      const { text, data } = readFrontMatter(file);
      expect(data.summary).toBe('new "quoted" summary');
      expect(Object.keys(data)).toEqual(["summary", "title", "author"]);
      expect(text).toContain("# Title");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("replaces a summary that is the last front matter field", () => {
    const { dir, file } = withArticle('title: "Title"\nauthor: "Team"\nsummary: "old"');
    try {
      upsertSummary(file, "replaced summary");
      const { data } = readFrontMatter(file);
      expect(data.summary).toBe("replaced summary");
      expect(Object.keys(data)).toEqual(["title", "author", "summary"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("inserts a single summary when none exists", () => {
    const { dir, file } = withArticle('title: "Title"\nauthor: "Team"');
    try {
      upsertSummary(file, "inserted summary");
      const { text, data } = readFrontMatter(file);
      expect(data.summary).toBe("inserted summary");
      expect(text.match(/^summary:/gm)).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
