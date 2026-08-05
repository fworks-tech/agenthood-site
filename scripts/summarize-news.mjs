/**
 * scripts/summarize-news.mjs <article.md> [--write]
 *
 * Drafts a one-sentence summary for a news article using OpenCode Go
 * (https://opencode.ai/zen/go/v1), authenticated with OPENCODE_API_KEY.
 * Prints the summary to stdout; with --write, inserts it into the article's
 * front matter as `summary: "..."`.
 *
 * Authoring-time helper only — never runs during builds.
 */
import fs from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";

const API_BASE = process.env.OPENCODE_API_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_NEWS_MODEL ?? "deepseek-v4-flash";
const MAX_SUMMARY_CHARS = 160;

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  try {
    return { meta: parseYaml(match[1]), body: match[2] };
  } catch {
    return null;
  }
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>+\s?/gm, "")
    .replace(/[*_~#|>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function summarize(text) {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENCODE_API_KEY is not set. Add it to your environment (see .env.example).");
  }

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: [
            "You write one-sentence news article summaries.",
            `Rules: plain text, no markdown, no quotes, no trailing period required, at most ${MAX_SUMMARY_CHARS} characters,`,
            "and mention the most concrete facts (numbers, product names, dates) over fluff.",
            "Do not show any reasoning. Respond immediately with only the summary text.",
          ].join(" "),
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`OpenCode Go request failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const summary = content.trim().replace(/^["']|["']$/g, "").replace(/[\r\n]+/g, " ");
  if (!summary) {
    throw new Error("OpenCode Go returned an empty summary.");
  }
  return summary.slice(0, MAX_SUMMARY_CHARS);
}

function upsertSummary(filePath, summary) {
  const text = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  const parsed = parseFrontMatter(text);
  if (!parsed) {
    throw new Error(`${filePath}: missing YAML front matter. Add front matter first, then re-run.`);
  }

  const encoded = summary.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let output;
  if (/^---\n([\s\S]*?)\nsummary:[\s\S]*?\n([\s\S]*)$/.test(text)) {
    output = text.replace(/^(---\n[\s\S]*?\n)summary:[^\n]*\n/, `$1summary: "${encoded}"\n`);
  } else {
    output = text.replace(/^(---\n[\s\S]*?\n)(---)/, `$1summary: "${encoded}"\n$2`);
  }
  fs.writeFileSync(filePath, output, "utf8");
}

const fileArg = process.argv[2];
const write = process.argv.includes("--write");

if (!fileArg) {
  console.error("Usage: node scripts/summarize-news.mjs <article.md> [--write]");
  process.exit(1);
}

const filePath = path.resolve(fileArg);
const parsed = parseFrontMatter(fs.readFileSync(filePath, "utf8"));
if (!parsed) {
  console.error(`${filePath}: missing YAML front matter. Add front matter first, then re-run.`);
  process.exit(1);
}

const source = `${plainText(parsed.body).slice(0, 2000)}`;
console.error(`[summarize-news] using ${MODEL} via ${API_BASE}`);

try {
  const summary = await summarize(source);
  console.log(summary);
  if (write) {
    upsertSummary(filePath, summary);
    console.error(`[summarize-news] wrote summary to ${filePath}`);
  }
} catch (err) {
  console.error(`[summarize-news] failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
