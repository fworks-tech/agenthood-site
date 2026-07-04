import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Breadcrumbs from "../../components/Breadcrumbs";

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

export default function NewsIndex() {
  const manifest = readManifest();
  const sorted = [...manifest].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Breadcrumbs segments={["news"]} />
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-2">
          News
        </h1>
        <p className="text-zinc-400 mb-12">
          Incident reports, release notes, and project updates.
        </p>
        <div className="space-y-6">
          {sorted.map((entry) => (
            <Link
              key={entry.slug.join("/")}
              href={`/news/${entry.slug.join("/")}`}
              className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors"
            >
              <time className="text-sm text-zinc-500">{entry.date}</time>
              <h2 className="text-lg font-semibold text-white mt-1">
                {entry.title}
              </h2>
              {entry.summary && (
                <p className="text-zinc-400 mt-1 text-sm">{entry.summary}</p>
              )}
              {entry.author && (
                <p className="text-xs text-zinc-600 mt-2">{entry.author}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
