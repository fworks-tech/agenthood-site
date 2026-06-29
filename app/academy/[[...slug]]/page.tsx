import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import MarkdownRenderer from "../../components/MarkdownRenderer";

const MANIFEST_PATH = path.join(process.cwd(), "content", "academy", "manifest.json");

interface ManifestEntry {
  slug: string[];
  path: string;
  title: string;
}

function readManifest(): ManifestEntry[] {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ManifestEntry[];
  } catch {
    return [];
  }
}

function findEntry(manifest: ManifestEntry[], slug: string[]): ManifestEntry | undefined {
  const key = slug.join("/");
  return manifest.find((entry) => entry.slug.join("/") === key);
}

export async function generateStaticParams() {
  const manifest = readManifest();
  return manifest.map((entry) => ({
    slug: entry.slug,
  }));
}

interface AcademyPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: AcademyPageProps) {
  const { slug = [] } = await params;
  const entry = findEntry(readManifest(), slug);
  return {
    title: entry ? `${entry.title} · Agenthood Academy` : "Agenthood Academy",
  };
}

export default async function AcademyPage({ params }: AcademyPageProps) {
  const { slug = [] } = await params;
  const entry = findEntry(readManifest(), slug);

  if (!entry) {
    notFound();
  }

  const filePath = path.join(process.cwd(), "content", entry.path);
  const markdown = fs.readFileSync(filePath, "utf8");
  const basePath = path.posix.dirname(entry.path);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">

      <div className="max-w-3xl mx-auto px-6 py-16">
        <MarkdownRenderer basePath={basePath}>{markdown}</MarkdownRenderer>
      </div>
    </main>
  );
}
