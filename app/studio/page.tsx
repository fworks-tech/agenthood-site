"use client";

import Link from "next/link";

interface StudioCard {
  title: string;
  description: string;
  href: string;
  icon: string;
  accent: string;
}

const cards: StudioCard[] = [
  {
    title: "Playground",
    description: "Try agents live in an interactive chat UI. Configure provider, model, temperature, and more.",
    href: "/studio/playground",
    icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    accent: "emerald",
  },
  {
    title: "Dashboard",
    description: "See runtime health, agent status, and activity across the Society.",
    href: "/studio/dashboard",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    accent: "blue",
  },
  {
    title: "Academy",
    description: "Learn how to use Agenthood in your projects — from RAG basics to autonomous agent loops.",
    href: "/academy",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    accent: "purple",
  },
];

function getAccentClasses(accent: string): string {
  switch (accent) {
    case "emerald":
      return "hover:border-emerald-700 group-hover:text-emerald-400 text-emerald-500";
    case "blue":
      return "hover:border-blue-700 group-hover:text-blue-400 text-blue-500";
    case "purple":
      return "hover:border-purple-700 group-hover:text-purple-400 text-purple-500";
    default:
      return "hover:border-zinc-600 group-hover:text-zinc-300 text-zinc-500";
  }
}

export default function StudioHubPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <section className="border-b border-zinc-800">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-400">Agenthood Studio</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Your browser-based HQ for the Society
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
            Chat, test agents, and monitor health, all built on plain Markdown skill files.
            A full AI engineering team as plain Markdown files. Zero tolerance for &ldquo;fix stuff&rdquo; commits.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition-colors hover:bg-zinc-900"
            >
              <div className={`mb-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 ${getAccentClasses(card.accent)}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-zinc-100 transition-colors">
                {card.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats / Society summary */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-sm font-semibold text-zinc-300">The Society at a glance</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Members", value: "16" },
              { label: "Providers", value: "3" },
              { label: "Skill files", value: "16" },
              { label: "Enforcement rules", value: "8+" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
