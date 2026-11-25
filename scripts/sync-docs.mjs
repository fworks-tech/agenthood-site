import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./lib/fetch-retry.mjs";
import { MEMBERS, skillDir, siteMemberId } from "./lib/members.mjs";

const REPO = "fworks-tech/agenthood";
const BRANCH = "main";
const API_BASE = `https://api.github.com/repos/${REPO}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const CONTENT_DIR = path.join(process.cwd(), "content");

const token = process.env.GITHUB_TOKEN;

async function api(url) {
  const res = await fetchWithRetry(
    url,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
    { retryRateLimit: true },
  );

  return res.json();
}

const CONCURRENCY = 8;

export async function mapInBatches(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function encodeRawPath(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function mirrorUrl(filePath) {
  return `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${encodeRawPath(filePath)}`;
}

async function fetchRaw(filePath) {
  const url = `${RAW_BASE}/${encodeRawPath(filePath)}`;
  const res = await fetchWithRetry(url, undefined, { mirrors: [mirrorUrl(filePath)] });
  return res.text();
}

function titleFromMarkdown(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith("# "));
  return line ? line.trim().replace(/^#\s+/, "") : "";
}

function buildSlug(relativePath) {
  const parts = relativePath.split("/");
  return parts
    .map((part, index) => {
      const isLast = index === parts.length - 1;
      if (isLast && part.toLowerCase() === "readme.md") {
        return null;
      }
      if (isLast) {
        return part.replace(/\.md$/i, "");
      }
      return part;
    })
    .filter(Boolean);
}

const MEMBER_IDS = new Set(MEMBERS);

// Upstream member READMEs link to ../../skills/<member>/SKILL.md, which does
// not exist in the site mirror — point them at the rendered member page. 4.0
// stripped the the- prefix from skill directories and registry ids, but the
// site's canonical ids keep it, so normalize member ids here. Utility skills
// have no member page, so their SKILL.md link goes to the source file.
// The academy README links to ARTICLE_TEMPLATE.md, which the site does not
// publish (it is skipped during sync), so point it at the upstream source.
function rewriteMemberSkillLinks(content) {
  return content
    .replace(
      /\]\(\.\.\/\.\.\/skills\/([^)/]+)\/SKILL\.md\)/g,
      (_match, member) => `](/docs/members/${siteMemberId(member)}/)`,
    )
    .replace(/\]\(\.?\/?ARTICLE_TEMPLATE\.md(?:\s+"[^"]*")?\)/g, "](https://github.com/fworks-tech/agenthood/blob/main/docs/academy/ARTICLE_TEMPLATE.md)")
    .replace(/\]\(\/docs\/members\/([^)/]+)\/\)/g, (match, member) => {
      const id = siteMemberId(member);
      if (MEMBER_IDS.has(id)) return `](/docs/members/${id}/)`;
      return `](https://github.com/${REPO}/blob/${BRANCH}/skills/${skillDir(id)}/SKILL.md)`;
    });
}

async function syncDirectory(sourceDir, destDir, tree) {
  const sourcePrefix = `${sourceDir}/`;

  const files = tree.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.startsWith(sourcePrefix) &&
      item.path.endsWith(".md")
  );

  if (files.length === 0) {
    console.warn(`No markdown files found under ${sourcePrefix}`);
  }

  const entries = await mapInBatches(files, CONCURRENCY, async (file) => {
    const relative = file.path.slice(sourcePrefix.length);
    if (path.basename(relative).toLowerCase() === "article_template.md") {
      return null;
    }

    const content = rewriteMemberSkillLinks(await fetchRaw(file.path));
    const destPath = path.join(CONTENT_DIR, destDir, relative);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, "utf8");

    return {
      slug: buildSlug(relative),
      path: path.posix.join(destDir, relative),
      title: titleFromMarkdown(content),
    };
  });

  const sorted = entries.filter(Boolean).sort((a, b) => a.path.localeCompare(b.path));

  const manifestPath = path.join(CONTENT_DIR, destDir, "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(sorted, null, 2), "utf8");

  console.log(`Synced ${sorted.length} files to content/${destDir}`);
}

async function syncFile(sourcePath, destPath) {
  const content = await fetchRaw(sourcePath);
  const out = path.join(CONTENT_DIR, destPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  console.log(`Synced ${sourcePath} to ${destPath}`);
}

async function syncFullDocs(tree) {
  const excludePrefixes = ["docs/academy/", "docs/adr/"];
  const excludeExact = ["docs/release-notes.md"];

  const sourcePrefix = "docs/";
  const files = tree.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.startsWith(sourcePrefix) &&
      item.path.endsWith(".md") &&
      !excludePrefixes.some((p) => item.path.startsWith(p)) &&
      !excludeExact.includes(item.path)
  );

  const entries = await mapInBatches(files, CONCURRENCY, async (file) => {
    const relative = file.path.slice(sourcePrefix.length);
    const content = rewriteMemberSkillLinks(await fetchRaw(file.path));
    const destPath = path.join(CONTENT_DIR, "docs", relative);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, "utf8");

    return {
      slug: buildSlug(relative),
      path: path.posix.join("docs", relative),
      title: titleFromMarkdown(content),
    };
  });

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const manifestPath = path.join(CONTENT_DIR, "docs", "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), "utf8");

  console.log(`Synced ${entries.length} files to content/docs`);
}

async function main() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const tree = await api(`${API_BASE}/git/trees/${BRANCH}?recursive=1`);
  if (tree.truncated) {
    throw new Error("GitHub tree response was truncated; refusing to generate a partial docs sync");
  }

  await syncDirectory("docs/academy", "academy", tree);
  await syncDirectory("docs/adr", "adr", tree);
  await syncFile("docs/release-notes.md", "release-notes.md");
  await syncFullDocs(tree);

  console.log("Docs sync complete.");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
