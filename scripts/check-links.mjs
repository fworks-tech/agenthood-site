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

const manifests = new Map(SECTIONS.map(([dir]) => [dir, readManifest(dir)]));
const routes = new Set(STATIC_ROUTES.map(normalize));
for (const [dir, prefix] of SECTIONS) {
  for (const entry of manifests.get(dir)) {
    const slug = Array.isArray(entry.slug) ? entry.slug.join("/") : entry.slug;
    routes.add(`${prefix}${slug}/`.replace(/\/+/g, "/"));
  }
}

// Only absolute links are checked here; relative links are resolved at render
// time by MarkdownRenderer.rewriteHref and can still 404 (issue #331).
const broken = [];
for (const [dir] of SECTIONS) {
  for (const entry of manifests.get(dir)) {
    const lines = fs.readFileSync(path.join(CONTENT_DIR, entry.path), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/\]\((\/[^)\s]+)\)/g)) {
        const target = normalize(match[1]);
        if (target && !routes.has(target)) {
          broken.push(`${entry.path}:${index + 1} -> ${target}`);
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

console.log(`check-links: ${routes.size} routes, no broken absolute internal links`);
