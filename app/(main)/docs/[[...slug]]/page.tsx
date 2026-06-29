import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownRenderer from "../../../components/MarkdownRenderer";
import Breadcrumbs from "../../../components/Breadcrumbs";

const MANIFEST_PATH = path.join(process.cwd(), "content", "docs", "manifest.json");

interface ManifestEntry {
  slug: string[];
  path: string;
  title: string;
}

const SECTION_LABELS: Record<string, string> = {
  architecture: "Architecture",
  members: "Members",
  "agentic-workflows": "Agentic Workflows",
  governance: "Governance",
  portals: "Portals",
  guides: "Guides",
  conventions: "Conventions",
  rituals: "Rituals",
  specs: "Specs",
  templates: "Templates",
  "runtime-guide": "Runtime Guide",
};

const MEMBER_ICONS: Record<string, string> = {
  "the-scribe": "✍️",
  "the-architect": "🏗️",
  "the-reviewer": "🔍",
  "the-tester": "🧪",
  "the-debugger": "🐛",
  "the-auditor": "🔒",
  "the-herald": "📦",
  "the-librarian": "📝",
  "the-doorman": "🚪",
  "the-oracle": "🔮",
  "the-envoy": "🌐",
  "the-sentinel": "👁️",
  "the-warden": "⚖️",
  "the-steward": "🧭",
  "the-strategist": "🎯",
  "the-operator": "🩺",
};

const SECTION_ORDER = [
  "architecture",
  "members",
  "agentic-workflows",
  "governance",
  "portals",
  "guides",
  "conventions",
  "rituals",
  "specs",
  "templates",
  "runtime-guide",
];

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

function displayName(slugPart: string): string {
  return slugPart
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateStaticParams() {
  const manifest = readManifest();
  return [{ slug: [] }, ...manifest.map((entry) => ({ slug: entry.slug }))];
}

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { slug = [] } = await params;
  if (slug.length === 0) return { title: "Docs · Agenthood" };

  const entry = findEntry(readManifest(), slug);
  if (entry) return { title: `${entry.title} · Agenthood Docs` };

  const sectionLabel = SECTION_LABELS[slug.join("/")] || displayName(slug.join("/"));
  return { title: `${sectionLabel} · Agenthood Docs` };
}

function DocsIndex({ manifest }: { manifest: ManifestEntry[] }) {
  const grouped = new Map<string, ManifestEntry[]>();

  for (const entry of manifest) {
    const section = entry.slug[0] || "other";
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(entry);
  }

  const sortedSections = SECTION_ORDER.filter((s) => grouped.has(s));

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <Breadcrumbs segments={["docs"]} />
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-2">
        Docs
      </h1>
      <p className="text-zinc-400 mb-12">
        Everything you need to know about Agenthood.
      </p>

      <div className="space-y-12">
        {sortedSections.map((section) => {
          const entries = grouped.get(section)!;
          const sectionHref = `/docs/${section}/`;
          const sectionLabel = SECTION_LABELS[section] || displayName(section);

          return (
            <section key={section}>
              <h2 className="text-2xl font-semibold text-white mb-4">
                <Link href={sectionHref} className="hover:text-emerald-400 transition-colors">
                  {sectionLabel}
                </Link>
              </h2>
              <ul className="space-y-2">
                {entries.map((entry) => {
                  const isReadme = entry.slug.length === 1;
                  if (isReadme) return null;
                  const href = `/docs/${entry.slug.join("/")}/`;
                  return (
                    <li key={entry.slug.join("/")}>
                      <Link
                        href={href}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <span className="text-zinc-200 font-medium">{entry.title || displayName(entry.slug[entry.slug.length - 1])}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SectionIndex({ slug, entries, title }: { slug: string[]; entries: ManifestEntry[]; title: string }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Breadcrumbs segments={["docs", ...slug]} />
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-8">
        {title}
      </h1>
      <ul className="space-y-3">
        {entries.map((entry) => {
          const href = `/docs/${entry.slug.join("/")}/`;
          return (
            <li key={entry.slug.join("/")}>
              <Link
                href={href}
                className="block bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-4 hover:border-zinc-600 transition-colors"
              >
                <span className="text-white font-medium">{entry.title || displayName(entry.slug[entry.slug.length - 1])}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug = [] } = await params;
  const manifest = readManifest();

  if (slug.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <DocsIndex manifest={manifest} />
      </main>
    );
  }

  const entry = findEntry(manifest, slug);
  if (entry) {
    const filePath = path.join(process.cwd(), "content", entry.path);
    let markdown = fs.readFileSync(filePath, "utf8");
    const isMemberPage = slug.length === 2 && slug[0] === "members";
    if (isMemberPage) {
      const icon = MEMBER_ICONS[slug[1]];
      if (icon) markdown = `${icon} ${markdown}`;
    }
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Breadcrumbs segments={["docs", ...slug]} />
          <MarkdownRenderer basePath="docs">{markdown}</MarkdownRenderer>
        </div>
      </main>
    );
  }

  const prefix = slug.join("/");
  const sectionEntries = manifest.filter((e) => {
    const key = e.slug.join("/");
    return key === prefix || key.startsWith(prefix + "/");
  });

  if (sectionEntries.length > 0) {
    const sectionLabel = SECTION_LABELS[prefix] || displayName(prefix);
    const topLevel = sectionEntries.filter((a) =>
      !sectionEntries.some((b) =>
        b.slug.length < a.slug.length &&
        b.slug.every((s, i) => s === a.slug[i])
      )
    );
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
        <SectionIndex slug={slug} entries={topLevel} title={sectionLabel} />
      </main>
    );
  }

  notFound();
}
