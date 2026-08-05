/**
 * scripts/build-news-manifest.mjs
 *
 * Generates content/news/manifest.json from the front matter of the articles
 * in content/news/. Runs locally on predev/prebuild — no network access.
 *
 * Contract (validated per article, exits 1 on violation unless --lenient):
 * - YAML front matter with `title`, `date` (YYYY-MM-DD), `author`, `summary`
 * - `title` must match the first `# ` heading
 *
 * `--lenient` (used by predev) skips invalid articles with a warning so the
 * dev server still boots while an article is being written; prebuild stays strict.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";

const CONTENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content");
const NEWS_DIR = path.join(CONTENT_DIR, "news");
const MANIFEST_PATH = path.join(NEWS_DIR, "manifest.json");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function buildNewsManifest({ strict = true } = {}) {
  const files = fs
    .readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const entries = [];

  for (const file of files) {
    const filePath = path.join(NEWS_DIR, file);
    const text = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
    try {
      entries.push(buildEntry(file, text));
    } catch (err) {
      if (strict) throw err;
      console.warn(`[news-manifest] skipping ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });

  return entries;
}

function buildEntry(file, text) {
  const slug = file.replace(/\.md$/i, "");

  const frontMatter = parseFrontMatter(text);
  if (!frontMatter.ok) {
    const detail = frontMatter.reason === "invalid"
      ? "invalid YAML in front matter"
      : "missing YAML front matter";
    throw new Error(detail);
  }

  const { title, date, author, summary } = frontMatter.data;

  if (typeof title !== "string" || !title.trim()) {
    throw new Error(`front matter must define a non-empty "title"`);
  }
  if (typeof date !== "string" || !DATE_PATTERN.test(date) || Number.isNaN(new Date(date).getTime())) {
    throw new Error(`front matter "date" must be an ISO date (YYYY-MM-DD)`);
  }
  if (typeof author !== "string" || !author.trim()) {
    throw new Error(`front matter must define a non-empty "author"`);
  }
  if (typeof summary !== "string" || !summary.trim()) {
    throw new Error(`front matter must define a non-empty "summary"`);
  }

  const heading = titleFromMarkdown(text);
  if (heading && heading !== title) {
    throw new Error(
      `front matter "title" (${JSON.stringify(title)}) does not match the "# " heading (${JSON.stringify(heading)})`,
    );
  }

  return {
    slug: [slug],
    path: `news/${file}`,
    title,
    date,
    author,
    summary,
  };
}

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { ok: false, reason: "missing" };
  try {
    const parsed = parseYaml(match[1]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

function titleFromMarkdown(text) {
  const line = text.split("\n").find((l) => l.trim().startsWith("# "));
  return line ? line.trim().replace(/^#\s+/, "") : "";
}

function main() {
  const lenient = process.argv.includes("--lenient");
  const entries = buildNewsManifest({ strict: !lenient });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");
  console.log(`[news-manifest] wrote ${entries.length} entries to content/news/manifest.json`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
