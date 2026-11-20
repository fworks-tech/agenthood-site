import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveHref, isAbsoluteUrl } from "../app/_lib/markdown-links.mjs";

export function normalize(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean.startsWith("/")) return null;
  if (path.extname(clean)) return clean;
  return clean.endsWith("/") ? clean : `${clean}/`;
}

// Pure, testable core: given file content, its basePath and the route set,
// return the broken internal links found in it.
export function findBrokenLinks(content, basePath, routes) {
  const broken = [];
  let checked = 0;
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = match[1];
      if (isAbsoluteUrl(href) || href.startsWith("#")) continue;
      const resolved = resolveHref(href, basePath);
      if (!resolved.startsWith("/")) continue;
      checked++;
      const target = normalize(resolved);
      if (target && !routes.has(target)) {
        broken.push({ line: index + 1, href, target });
      }
    }
  });
  return { broken, checked };
}

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

function main() {
  const manifests = new Map(SECTIONS.map(([dir]) => [dir, readManifest(dir)]));
  const routes = new Set(STATIC_ROUTES.map(normalize));
  for (const [dir, prefix] of SECTIONS) {
    for (const entry of manifests.get(dir)) {
      const slug = Array.isArray(entry.slug) ? entry.slug.join("/") : entry.slug;
      routes.add(`${prefix}${slug}/`.replace(/\/+/g, "/"));
    }
  }

  let totalChecked = 0;
  const broken = [];
  for (const [dir] of SECTIONS) {
    for (const entry of manifests.get(dir)) {
      const content = fs.readFileSync(path.join(CONTENT_DIR, entry.path), "utf8");
      const basePath = path.posix.dirname(entry.path);
      const result = findBrokenLinks(content, basePath, routes);
      totalChecked += result.checked;
      for (const item of result.broken) {
        broken.push(`${entry.path}:${item.line} -> ${item.target} (from ${item.href})`);
      }
    }
  }

  if (broken.length > 0) {
    console.error(`check-links: ${broken.length} broken internal link(s)`);
    for (const item of broken) console.error(`  ${item}`);
    process.exit(1);
  }

  console.log(`check-links: ${routes.size} routes, ${totalChecked} internal links, no broken internal links`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}