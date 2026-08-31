import Link from "next/link";
import { Text, Group, Badge, SimpleGrid } from "@mantine/core";
import {
  IconPlayerPlay,
  IconCode,
  IconUsers,
  IconCloud,
  IconServer,
  IconKey,
  IconShield,
  IconClock,
  IconBulb,
  IconUsersGroup,
} from "@tabler/icons-react";
import HelpTip from "./studio/_components/HelpTip";
import FadeIn from "../_components/FadeIn";
import InstallBlock from "../_components/InstallBlock";
import { ClientCTA } from "./_client-cta";
import { agents } from "./studio/_data/agents";

const teamMembers = agents.map((a) => ({
  name: a.name,
  slug: a.id,
  icon: a.icon ?? "🤖",
  desc: a.shortDescription || a.role,
  category: a.category,
}));

const categories = [
  { id: "engineering", label: "Engineering", icon: IconCode, accent: "bg-emerald-500", desc: "Building things" },
  { id: "validation", label: "Validation", icon: IconShield, accent: "bg-amber-500", desc: "Gatekeeping quality" },
  { id: "lifecycle", label: "Lifecycle", icon: IconClock, accent: "bg-sky-500", desc: "Process & flow" },
  { id: "knowledge", label: "Knowledge", icon: IconBulb, accent: "bg-violet-500", desc: "Research & docs" },
];

const features = [
  { icon: IconUsers, label: `${agents.length} agents`, desc: "architect, reviewer, tester, and more", color: "text-emerald-400", tip: `All ${agents.length} Society members available with their full system prompts from SKILL.md.` },
  { icon: IconCloud, label: "7 providers", desc: "Anthropic, OpenAI, Groq, OpenRouter, Ollama, OpenCode", color: "text-sky-400", tip: "Switch providers per conversation. Each offers different models and pricing." },
  { icon: IconServer, label: "SSE streaming", desc: "real-time token-by-token responses", color: "text-cyan-400", tip: "Responses stream progressively via Server-Sent Events for instant feedback." },
  { icon: IconKey, label: "BYOK", desc: "use your own API keys", color: "text-amber-400", tip: "Bring Your Own Key — provide an API key per request or use the server default." },
];

const steps = [
  { step: "01", title: "Install the Society", body: "npm install agenthood && npx agenthood init — interactive setup, hooks, and conventions in ~2 minutes." },
  { step: "02", title: "Load into your runtime", body: "Skill files install automatically. Or run members autonomously: agenthood run the-scribe \"write a commit message\"." },
  { step: "03", title: "Invoke any agent", body: "Ask the Reviewer to check your PR. Ask the Auditor to scan your auth flow. They know their role." },
];

export default function Home() {
  return (
    <main className="min-h-full bg-zinc-950 text-zinc-100 font-sans">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge variant="outline" color="dark" size="lg" className="mb-6 tracking-wide uppercase">
          Open source · AI dev tools
        </Badge>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white leading-tight mb-6">
          A full AI engineering team<br />
          <span className="text-zinc-500">as plain Markdown files.</span>
        </h1>
        <Text className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {agents.length} specialized AI agents — each a single Markdown skill file that works with
          Claude Code, Copilot, Gemini CLI, or any runtime. No lock-in. No configuration.
        </Text>
        <Group justify="center" gap="md">
          <a
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-zinc-950 font-medium px-6 py-3 rounded-lg hover:bg-zinc-100 transition-colors inline-block"
          >
            View on GitHub
          </a>
          <Link
            href="#how"
            className="text-zinc-400 border border-zinc-700 px-6 py-3 rounded-lg hover:border-zinc-500 hover:text-white transition-colors inline-block"
          >
            How it works
          </Link>
        </Group>
        <div className="mt-8 flex justify-center">
          <InstallBlock />
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 text-center">
          <div className="flex items-center justify-center gap-1 px-6">
            <div>
              <div className="text-3xl font-semibold text-white">{agents.length}</div>
              <div className="text-sm text-zinc-500 mt-1">Specialized agents</div>
            </div>
            <HelpTip text="Each agent has a unique role: architect, reviewer, tester, auditor, and more." side="right" />
          </div>
          <div className="flex items-center justify-center gap-1 px-6">
            <div>
              <div className="text-3xl font-semibold text-white">Any</div>
              <div className="text-sm text-zinc-500 mt-1">Agent runtime</div>
            </div>
            <HelpTip text="Works with Claude Code, Copilot, Gemini CLI, OpenCode, or any skill-file runtime." side="right" />
          </div>
          <div className="flex items-center justify-center gap-1 px-6">
            <div>
              <div className="text-3xl font-semibold text-white">Zero</div>
              <div className="text-sm text-zinc-500 mt-1">Tolerance for &ldquo;fix stuff&rdquo; commits</div>
            </div>
            <HelpTip text="Enforces conventional commits — vague messages are rejected." side="right" />
          </div>
        </div>
      </section>

      {/* Studio preview */}
      <FadeIn>
        <section className="border-y border-zinc-800 bg-gradient-to-b from-zinc-900/30 to-zinc-950">
          <div className="max-w-6xl mx-auto px-6 py-20 text-center">
            <Group justify="center" mb="md">
              <Badge variant="outline" color="emerald" size="sm" leftSection={<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}>
                Agenthood Studio
              </Badge>
            </Group>
            <h2 className="text-3xl font-semibold text-white mb-4">
              Try the Society in your browser
            </h2>
            <Text c="dimmed" className="max-w-2xl mx-auto mb-8 leading-relaxed">
              Pick any agent, choose your provider, and start a live conversation.
              No install, no setup — just you and the agents.
            </Text>
            <Group justify="center" gap="md" className="mb-10">
              <Link
                href="/studio/playground"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                <IconPlayerPlay size={16} />
                Open Playground
              </Link>
              <Link
                href="/studio/workspaces"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                <IconUsersGroup size={16} />
                Try Workspaces
              </Link>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
              >
                About Studio
              </Link>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
              {features.map((f) => (
                <div key={f.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
                  <f.icon size={28} className={`mx-auto mb-3 ${f.color}`} />
                  <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-zinc-200 mb-1.5">
                    {f.label}
                    <HelpTip text={f.tip} side="top" />
                  </div>
                  <div className="text-xs text-zinc-500 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </SimpleGrid>
          </div>
        </section>
      </FadeIn>

      {/* Agents grid — grouped by category */}
      <FadeIn>
        <section id="agents" className="max-w-6xl mx-auto px-6 pb-12 mt-18">
          <h2 className="text-3xl font-semibold text-white mb-4">Meet the team</h2>
          <Text c="dimmed" className="mb-12 max-w-2xl">
            Every role a real software team needs — available as a skill file with impeccable standards.
          </Text>
          <div className="space-y-12">
            {categories.map((cat) => {
              const catAgents = teamMembers.filter((a) => a.category === cat.id);
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-1 h-5 rounded-full ${cat.accent}`} />
                    <cat.icon size={18} className="text-zinc-400" />
                    <h3 className="text-lg font-semibold text-zinc-200">{cat.label}</h3>
                    <span className="text-xs text-zinc-600">{catAgents.length}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {catAgents.map((a) => (
                      <Link
                        key={a.name}
                        href={`/docs/members/${a.slug}/`}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors block"
                      >
                        <div className="text-2xl mb-3">{a.icon}</div>
                        <div className="text-white font-medium text-sm mb-1">{a.name}</div>
                        <div className="text-zinc-500 text-xs leading-relaxed">{a.desc}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </FadeIn>

      {/* How it works */}
      <FadeIn>
        <section id="how" className="max-w-6xl mx-auto px-6 py-10">
          <h2 className="text-3xl font-semibold text-white mb-4">How it works</h2>
          <Text c="dimmed" className="mb-12 w-full">
            Each agent is a single <code className="bg-zinc-800/70 text-zinc-300 px-1.5 py-0.5 rounded-md text-sm border border-zinc-700/50 font-mono">.md</code> file
            that describes a role, its responsibilities, standards, and how it communicates.
            Load one or all of them into Claude Code, Copilot, Gemini CLI, or any runtime that supports skill files.
            Or run them autonomously via the TypeScript CLI.
          </Text>
          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-8 left-[17%] right-[17%] h-px bg-zinc-800" />
            {steps.map((s) => (
              <div key={s.step} className="bg-zinc-900 border border-zinc-800 border-l-2 border-l-emerald-500 rounded-xl p-6 relative">
                <div className="text-emerald-400 text-xl font-bold font-mono mb-3">{s.step}</div>
                <div className="text-white font-medium mb-2">{s.title}</div>
                <div className="text-zinc-400 text-sm leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </section>
      </FadeIn>

      {/* CTA */}
      <ClientCTA />

    </main>
  );
}
