/**
 * scripts/generate-news-digest.mjs
 *
 * Drafts a news digest article for content/news/ covering Agenthood releases
 * that have not been reported on yet.
 *
 * Flow:
 *  1. Fetch releases from fworks-tech/agenthood via the GitHub API.
 *  2. Compute the window: releases published after the last covered release
 *     timestamp (content/news/.digest-state.json). The state file records the
 *     exact published_at of the newest covered release, so releases that ship
 *     later on the same calendar day as a digest are still picked up by the
 *     next run — comparing calendar dates alone would silently drop them.
 *  3. Ask OpenCode Go (deepseek-v4-flash, OPENCODE_API_KEY) to draft a full
 *     article in the house style (front matter + markdown body).
 *  4. Validate the draft against the same contract enforced by
 *     scripts/build-news-manifest.mjs; retry once on failure.
 *  5. Write content/news/<slug>.md, advance the digest state, and regenerate
 *     content/news/manifest.json.
 *
 * Authoring/automation helper only — never runs during builds.
 *
 * Usage:
 *   node scripts/generate-news-digest.mjs [--date YYYY-MM-DD] [--dry-run]
 *
 *   --date     Post date for the digest (defaults to today, UTC). Also drives
 *              the slug, so re-runs on the same day are idempotent.
 *   --dry-run  Print the drafted article to stdout without writing anything.
 *
 * Prints "WROTE <path>" on success, "NOOP <reason>" when there is nothing to
 * write, or exits 1 on failure (e.g. invalid LLM output).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";
import { buildNewsManifest } from "./build-news-manifest.mjs";

const REPO = "fworks-tech/agenthood";
const API_BASE = `https://api.github.com/repos/${REPO}`;
const NEWS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "news");
const MANIFEST_PATH = path.join(NEWS_DIR, "manifest.json");
const STATE_PATH = path.join(NEWS_DIR, ".digest-state.json");

const OPENCODE_API_BASE = process.env.OPENCODE_NEWS_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_NEWS_MODEL ?? "deepseek-v4-flash";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SUMMARY_CHARS = 160;

async function fetchWithRetry(url, options, { retries = 3, baseDelayMs = 1000 } = {}) {
  let res;
  for (let attempt = 0; attempt <= retries; attempt++) {
    res = await fetch(url, options);
    if (res.ok || res.status < 500) return res;
    if (attempt === retries) return res;
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
  }
  return res;
}

export async function listReleases(cutoffAt, { retries = 3, baseDelayMs = 1000 } = {}) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const releases = [];
  for (let page = 1; page <= 10; page++) {
    const url = `${API_BASE}/releases?per_page=100&page=${page}`;
    const res = await fetchWithRetry(url, { headers }, { retries, baseDelayMs });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status} for ${url}: ${text}`);
    }
    const batch = await res.json();
    releases.push(...batch);
    if (batch.length < 100) break;
    if (cutoffAt && batch.some((release) => (release.published_at ?? "") <= cutoffAt)) break;
  }
  return releases;
}

function newestNewsDate() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const dates = manifest.map((entry) => entry.date).filter((d) => DATE_PATTERN.test(d));
    return dates.length ? dates.sort().at(-1) : null;
  } catch {
    return null;
  }
}

export function loadDigestState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (typeof state?.lastReleaseAt === "string" && state.lastReleaseAt) return state;
  } catch {
    // no state yet — fall back to the manifest date below
  }
  return null;
}

export function newestReleaseAt(releases) {
  const timestamps = releases
    .map((release) => release.published_at ?? "")
    .filter((at) => typeof at === "string" && at.length > 0);
  return timestamps.length ? timestamps.sort().at(-1) : null;
}

function releaseDate(release) {
  return (release.published_at ?? "").slice(0, 10);
}

export function releasesAfter(releases, cutoffAt) {
  if (!cutoffAt) return releases;
  return releases.filter((release) => (release.published_at ?? "") > cutoffAt);
}

export function buildSlug(date) {
  return `whats-new-${date}.md`;
}

function formatReleases(releases) {
  return releases
    .map((release) => {
      const body = (release.body ?? "").trim();
      return `## ${release.tag_name} — ${releaseDate(release)}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}

function systemPrompt() {
  return [
    "You are the news writer for Agenthood, an open-source AI agent society.",
    "You write warm, professional, and precise release digests for the /news section of the website.",
    "",
    "Voice and tone:",
    "- First-person plural and approachable (\"We've shipped…\", \"Here's what's new.\"), never hypey.",
    "- Confident but measured — no emoji, no exclamation marks, no \"game-changing\" marketing.",
    "- Explain what changed and why it matters; prefer concrete details (limits, timeouts, files) over vague praise.",
    "- Stay accurate to the changelog. Do NOT invent features, fixes, links, or press quotes.",
    "",
    "Format (strict):",
    "- Start with YAML front matter: title, date (YYYY-MM-DD, use the post date given), author (\"Agenthood Team\"), and a summary of at most 160 characters.",
    "- The front matter title MUST be exactly the first \"# \" heading.",
    "- Under the H1 add two lines: \"**Date:** <human-readable>\" and \"**Author:** Agenthood Team\".",
    "- Use \"## \" sections, grouped by theme or by release version when multiple releases shipped.",
    "- Use \"### \" sub-headings for individual items, bolded leading terms in bullets (\"- **Component:** description\"), numbered lists for step-by-step flows, and tables for structured data when useful.",
    "- End with a short \"## What's Next\" section when the changelogs suggest direction; otherwise omit it.",
    "- Output ONLY the complete Markdown article (front matter + body). No code fences, no commentary, no trailing prose.",
  ].join("\n");
}

function userPrompt(postDate, releases) {
  return [
    `Write a news digest dated ${postDate} covering the following unreleased Agenthood releases.`,
    "Group them sensibly — one section per release if there are only a few, or by theme if there are many.",
    "",
    formatReleases(releases),
  ].join("\n");
}

async function draftArticle(postDate, releases, onError) {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENCODE_API_KEY is not set. Add it to your environment (see .env.example).");
  }

  const res = await fetchWithRetry(`${OPENCODE_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(postDate, releases) },
        ...(onError ? [{ role: "user", content: onError }] : []),
      ],
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`OpenCode Go request failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("OpenCode Go returned an empty article.");
  }
  return trimmed.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
}

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  try {
    const parsed = parseYaml(match[1]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return { data: parsed, body: text.slice(match[0].length) };
  } catch {
    return null;
  }
}

function titleFromMarkdown(text) {
  const line = text.split("\n").find((l) => l.trim().startsWith("# "));
  return line ? line.trim().replace(/^#\s+/, "") : "";
}

export function validateArticle(text, postDate) {
  const errors = [];
  const parsed = parseFrontMatter(text);
  if (!parsed) {
    errors.push("missing or invalid YAML front matter");
    return { ok: false, errors };
  }

  const { title, date, author, summary } = parsed.data;
  if (typeof title !== "string" || !title.trim()) {
    errors.push('front matter must define a non-empty "title"');
  }
  if (typeof date !== "string" || date !== postDate) {
    errors.push(`front matter "date" must be the post date (${postDate})`);
  }
  if (typeof author !== "string" || !author.trim()) {
    errors.push('front matter must define a non-empty "author"');
  }
  if (typeof summary !== "string" || !summary.trim()) {
    errors.push('front matter must define a non-empty "summary"');
  } else if (summary.length > MAX_SUMMARY_CHARS) {
    errors.push(`front matter "summary" must be at most ${MAX_SUMMARY_CHARS} characters`);
  }

  const heading = titleFromMarkdown(parsed.body);
  if (typeof title === "string" && heading && heading !== title) {
    errors.push(
      `front matter "title" (${JSON.stringify(title)}) does not match the "# " heading (${JSON.stringify(heading)})`,
    );
  }

  return errors.length ? { ok: false, errors } : { ok: true, data: parsed.data, body: parsed.body };
}

function normalizeSummary(summary) {
  const cleaned = summary.replace(/[\r\n]+/g, " ").trim();
  return cleaned.length > MAX_SUMMARY_CHARS ? `${cleaned.slice(0, MAX_SUMMARY_CHARS - 1)}…` : cleaned;
}

function escapeYaml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildArticle(postDate, valid) {
  const summary = normalizeSummary(valid.data.summary);
  return [
    "---",
    `title: "${escapeYaml(valid.data.title)}"`,
    `date: ${postDate}`,
    `author: "${escapeYaml(valid.data.author)}"`,
    `summary: "${escapeYaml(summary)}"`,
    "---",
    "",
    valid.body.trim(),
    "",
  ].join("\n");
}

async function generate({ postDate, dryRun = false, logger = { log: (m) => console.error(m) } }) {
  const state = loadDigestState();
  const manifestCutoff = newestNewsDate();
  const cutoff = state?.lastReleaseAt ?? (manifestCutoff ? `${manifestCutoff}T00:00:00Z` : null);
  logger.log(`[news-digest] newest news date: ${manifestCutoff ?? "none"}`);
  logger.log(`[news-digest] releases cutoff: ${cutoff ?? "none"}`);

  const releases = releasesAfter(await listReleases(cutoff), cutoff);
  if (releases.length === 0) {
    logger.log("[news-digest] no releases to report");
    return { status: "noop", reason: "no releases after the last news post" };
  }

  const slug = buildSlug(postDate);
  const targetPath = path.join(NEWS_DIR, slug);
  if (fs.existsSync(targetPath)) {
    logger.log(`[news-digest] ${slug} already exists`);
    return { status: "noop", reason: `${slug} already exists` };
  }

  logger.log(`[news-digest] drafting digest for ${releases.length} release(s)`);
  let article;
  let feedback;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const draft = await draftArticle(postDate, releases, feedback);
    const valid = validateArticle(draft, postDate);
    if (valid.ok) {
      article = buildArticle(postDate, valid);
      break;
    }
    if (attempt === 1) {
      feedback = `Your draft was rejected for: ${valid.errors.join("; ")}. Please fix these issues and output the complete corrected article (front matter + body) only.`;
      logger.log(`[news-digest] draft invalid (${valid.errors.join("; ")}); retrying once`);
    } else {
      throw new Error(`LLM output invalid after retry: ${valid.errors.join("; ")}`);
    }
  }

  if (dryRun) {
    logger.log(`[news-digest] dry-run, would write ${slug}`);
    console.log(article);
    return { status: "wrote", path: slug, dryRun: true };
  }

  fs.writeFileSync(targetPath, article, "utf8");
  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastReleaseAt: newestReleaseAt(releases) }, null, 2) + "\n", "utf8");
  const entries = buildNewsManifest();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2) + "\n", "utf8");
  logger.log(`[news-digest] wrote ${entries.length} entries to content/news/manifest.json`);
  return { status: "wrote", path: slug };
}

function main() {
  const argv = process.argv.slice(2);
  const dateIndex = argv.indexOf("--date");
  const dryRun = argv.includes("--dry-run");
  const postDate = dateIndex >= 0 ? argv[dateIndex + 1] : new Date().toISOString().slice(0, 10);

  if (!DATE_PATTERN.test(postDate)) {
    console.error(`[news-digest] invalid --date ${JSON.stringify(postDate)} (expected YYYY-MM-DD)`);
    process.exit(1);
  }

  generate({ postDate, dryRun })
    .then((result) => {
      if (result.status === "noop") {
        console.log(`NOOP ${result.reason}`);
      } else {
        console.log(`WROTE content/news/${result.path}`);
      }
    })
    .catch((err) => {
      console.error(`[news-digest] failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
