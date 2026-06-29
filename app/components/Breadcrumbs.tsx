import Link from "next/link";

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
  docs: "Docs",
  academy: "Academy",
  adr: "ADR",
};

function displayName(segment: string): string {
  return SECTION_LABELS[segment] || segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface BreadcrumbsProps {
  segments: string[];
}

export default function Breadcrumbs({ segments }: BreadcrumbsProps) {
  if (segments.length === 0) return null;

  const crumbs = segments.map((_, i) => ({
    label: displayName(segments[i]),
    href: "/" + segments.slice(0, i + 1).join("/") + "/",
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-zinc-500">
      <ol className="flex items-center gap-2 flex-wrap">
        <li>
          <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Home
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-2">
            <span className="text-zinc-700">/</span>
            {crumb.isLast ? (
              <span className="text-zinc-300 font-medium">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
