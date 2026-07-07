"use client";

import Link from "next/link";
import { Anchor, Text } from "@mantine/core";

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
  news: "News",
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
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 flex-wrap text-sm text-zinc-500">
        <li>
          <Anchor component={Link} href="/" c="emerald.4">
            Home
          </Anchor>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-2">
            <span className="text-zinc-700">/</span>
            {crumb.isLast ? (
              <Text c="gray.3" fw={500} size="sm">
                {crumb.label}
              </Text>
            ) : (
              <Anchor component={Link} href={crumb.href} c="emerald.4" size="sm">
                {crumb.label}
              </Anchor>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
