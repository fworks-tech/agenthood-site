import fs from "node:fs";
import path from "node:path";

const REPO = "fworks-tech/agenthood";
const BRANCH = "main";
const API_BASE = `https://api.github.com/repos/${REPO}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const CONTENT_DIR = path.join(process.cwd(), "content");

const token = process.env.GITHUB_TOKEN;

async function api(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status} for ${url}: ${text}`);
  }

  return res.json();
}

function encodeRawPath(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function fetchRaw(filePath) {
  const url = `${RAW_BASE}/${encodeRawPath(filePath)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch raw ${filePath}: ${res.status} ${res.statusText}`);
  }
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

async function syncDirectory(sourceDir, destDir) {
  const sourcePrefix = `${sourceDir}/`;
  const tree = await api(`${API_BASE}/git/trees/${BRANCH}?recursive=1`);

  const files = tree.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.startsWith(sourcePrefix) &&
      item.path.endsWith(".md")
  );

  if (files.length === 0) {
    console.warn(`No markdown files found under ${sourcePrefix}`);
  }

  const entries = [];

  for (const file of files) {
    const relative = file.path.slice(sourcePrefix.length);
    if (path.basename(relative).toLowerCase() === "article_template.md") {
      continue;
    }

    const content = await fetchRaw(file.path);
    const destPath = path.join(CONTENT_DIR, destDir, relative);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, "utf8");

    entries.push({
      slug: buildSlug(relative),
      path: path.posix.join(destDir, relative),
      title: titleFromMarkdown(content),
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));

  const manifestPath = path.join(CONTENT_DIR, destDir, "manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2), "utf8");

  console.log(`Synced ${entries.length} files to content/${destDir}`);
}

async function syncFile(sourcePath, destPath) {
  const content = await fetchRaw(sourcePath);
  const out = path.join(CONTENT_DIR, destPath);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, "utf8");
  console.log(`Synced ${sourcePath} to ${destPath}`);
}

async function main() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  await syncDirectory("docs/academy", "academy");
  await syncDirectory("docs/adr", "adr");
  await syncFile("docs/release-notes.md", "release-notes.md");
  console.log("Docs sync complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
