import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownRenderer from "../../../components/MarkdownRenderer";

const MANIFEST_PATH = path.join(process.cwd(), "content", "adr", "manifest.json");

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
  return [{ slug: [] }, ...manifest.map((entry) => ({ slug: entry.slug }))];
}

interface AdrPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: AdrPageProps) {
  const { slug = [] } = await params;
  const entry = findEntry(readManifest(), slug);
  return {
    title: entry ? `${entry.title} · Agenthood ADR` : "Architecture Decision Records",
  };
}

function AdrIndex({ manifest }: { manifest: ManifestEntry[] }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
        Architecture Decision Records
      </h1>
      <p className="text-zinc-400 mb-10">
        Design decisions that shape the Society.
      </p>

      <ul className="space-y-3">
        {manifest.map((entry) => (
          <li key={entry.slug.join("/")}>
            <Link
              href={`/adr/${entry.slug.join("/")}/`}
              className="block bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4 hover:border-zinc-600 transition-colors"
            >
              <span className="text-white font-medium">{entry.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function AdrPage({ params }: AdrPageProps) {
  const { slug = [] } = await params;
  const manifest = readManifest();

  if (slug.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <AdrIndex manifest={manifest} />
      </main>
    );
  }

  const entry = findEntry(manifest, slug);
  if (!entry) {
    notFound();
  }

  const filePath = path.join(process.cwd(), "content", entry.path);
  const markdown = fs.readFileSync(filePath, "utf8");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">

      <div className="max-w-3xl mx-auto px-6 py-16">
        <MarkdownRenderer basePath="adr">{markdown}</MarkdownRenderer>
      </div>
    </main>
  );
}
