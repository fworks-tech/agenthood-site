import fs from "node:fs";
import path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "content");
const SECTIONS = [
  ["docs", "/docs/"],
  ["academy", "/academy/"],
  ["adr", "/adr/"],
  ["news", "/news/"],
];
const STATIC_ROUTES = [
  "/",
  "/docs/",
  "/academy/",
  "/adr/",
  "/news/",
  "/releases/",
  "/getting-started/",
  "/studio/",
  "/studio/playground/",
  "/studio/workspaces/",
  "/news/rss.xml",
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  "/monitoring",
  "/favicon.ico",
];

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, dir, "manifest.json"), "utf8"));
  } catch {
    console.error(`check-links: missing content/${dir}/manifest.json (run npm run sync first)`);
    process.exit(1);
  }
}

function normalize(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean.startsWith("/")) return null;
  if (path.extname(clean)) return clean;
  return clean.endsWith("/") ? clean : `${clean}/`;
}

function walkMarkdown(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(full));
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

const routes = new Set(STATIC_ROUTES);
for (const [dir, prefix] of SECTIONS) {
  for (const entry of readManifest(dir)) {
    const slug = Array.isArray(entry.slug) ? entry.slug.join("/") : entry.slug;
    routes.add(`${prefix}${slug}/`.replace(/\/+/g, "/"));
  }
}

const broken = [];
for (const [dir] of SECTIONS) {
  const root = path.join(CONTENT_DIR, dir);
  for (const file of walkMarkdown(root)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/\]\((\/[^)\s]+)\)/g)) {
        const target = normalize(match[1]);
        if (target && !routes.has(target)) {
          broken.push(`${path.relative(CONTENT_DIR, file)}:${index + 1} -> ${target}`);
        }
      }
    });
  }
}

if (broken.length > 0) {
  console.error(`check-links: ${broken.length} broken internal link(s)`);
  for (const item of broken) console.error(`  ${item}`);
  process.exit(1);
}

console.log(`check-links: ${routes.size} routes, no broken internal links`);
