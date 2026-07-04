import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

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

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const dynamic = "force-static";

export async function GET() {
  const manifest = readManifest();
  const sorted = [...manifest].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const items = sorted
    .map(
      (entry) => `
    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>https://agenthood.flabs.tech/news/${entry.slug.join("/")}</link>
      <pubDate>${new Date(entry.date).toUTCString()}</pubDate>
      <description>${escapeXml(entry.summary ?? "")}</description>
      <guid>https://agenthood.flabs.tech/news/${entry.slug.join("/")}</guid>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Agenthood News</title>
    <link>https://agenthood.flabs.tech/news</link>
    <description>Incident reports, release notes, and project updates from Agenthood</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://agenthood.flabs.tech/news/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
