import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import MarkdownRenderer from "../../../components/MarkdownRenderer";
import Breadcrumbs from "../../../components/Breadcrumbs";
import { logger } from "@/app/(main)/studio/_lib/logger";

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
  } catch (err) {
    logger.error("news.manifest.read_failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

function findEntry(slug: string[]): NewsEntry | undefined {
  const key = slug.join("/");
  return readManifest().find((entry) => entry.slug.join("/") === key);
}

export async function generateStaticParams() {
  const manifest = readManifest();
  return manifest.map((entry) => ({ slug: entry.slug[0] }));
}

interface NewsPostProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: NewsPostProps) {
  const { slug } = await params;
  const entry = findEntry([slug]);
  if (!entry) return { title: "News · Agenthood" };
  return { title: `${entry.title} · Agenthood News` };
}

export default async function NewsPost({ params }: NewsPostProps) {
  const { slug } = await params;
  const entry = findEntry([slug]);

  if (!entry) {
    logger.warn("news.post.not_found", { slug });
    notFound();
  }

  const filePath = path.join(process.cwd(), "content", entry.path);
  let markdown: string;
  try {
    markdown = fs.readFileSync(filePath, "utf8");
  } catch {
    logger.error("news.post.file_missing", { slug, path: entry.path });
    notFound();
  }

  logger.info("news.post.rendered", { slug, title: entry.title });

  const basePath = path.posix.dirname(entry.path);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumbs segments={["news", slug]} />
        <MarkdownRenderer basePath={basePath}>{markdown}</MarkdownRenderer>
      </div>
    </main>
  );
}
