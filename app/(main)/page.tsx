import Link from "next/link";

const agents = [
  { name: "The Scribe", slug: "the-scribe", icon: "✍️", desc: "Commits, PRs, changelogs" },
  { name: "The Architect", slug: "the-architect", icon: "🏗️", desc: "System design, ADRs, tech decisions" },
  { name: "The Reviewer", slug: "the-reviewer", icon: "🔍", desc: "Code review, standards enforcement" },
  { name: "The Tester", slug: "the-tester", icon: "🧪", desc: "TDD, coverage, edge cases" },
  { name: "The Debugger", slug: "the-debugger", icon: "🐛", desc: "Error triage, root cause analysis" },
  { name: "The Auditor", slug: "the-auditor", icon: "🔒", desc: "Security, vulnerability scanning, dependency audit" },
  { name: "The Herald", slug: "the-herald", icon: "📦", desc: "Releases, versioning, changelogs" },
  { name: "The Librarian", slug: "the-librarian", icon: "📝", desc: "Documentation, API references" },
  { name: "The Doorman", slug: "the-doorman", icon: "🚪", desc: "Validation, branch protection, health checks" },
  { name: "The Oracle", slug: "the-oracle", icon: "🔮", desc: "Institutional knowledge, authoring templates" },
  { name: "The Envoy", slug: "the-envoy", icon: "🌐", desc: "Cross-provider translation, convention validation" },
  { name: "The Sentinel", slug: "the-sentinel", icon: "👁️", desc: "Integrity, cross-member contradiction detection" },
  { name: "The Warden", slug: "the-warden", icon: "⚖️", desc: "Code health, complexity enforcement" },
  { name: "The Steward", slug: "the-steward", icon: "🧭", desc: "Context economy, provider cache strategies" },
  { name: "The Strategist", slug: "the-strategist", icon: "🎯", desc: "Goal refinement, requirement discovery" },
  { name: "The Operator", slug: "the-operator", icon: "🩺", desc: "Runtime health, deployments, rollback" },
];

export default function Home() {
  return (
    <main className="min-h-full bg-zinc-950 text-zinc-100 font-sans">

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-block text-xs font-medium bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
          Open source · AI dev tools
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white leading-tight mb-6">
          A full AI engineering team<br />
          <span className="text-zinc-500">as plain Markdown files.</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          16 specialized AI agents — architect, reviewer, security expert, DevOps engineer, strategist, operator, and more —
          each a single Markdown skill file any agent runtime can load into any project.
          Features autonomous agents with memory, RAG, CI enforcement, and multi-member orchestration.
          No lock-in. No configuration. Just drop them in.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-zinc-950 font-medium px-6 py-3 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            View on GitHub
          </a>
          <Link
            href="#how"
            className="text-zinc-400 border border-zinc-700 px-6 py-3 rounded-lg hover:border-zinc-500 hover:text-white transition-colors"
          >
            How it works
          </Link>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-3 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-xl px-5 py-2.5 font-mono text-sm shadow-inner">
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-200">npm install --save-dev agenthood</code>
          </div>
          <div className="inline-flex items-center gap-3 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-xl px-5 py-2.5 font-mono text-sm shadow-inner">
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-200">npx agenthood init</code>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 text-center">
          <div className="px-6">
            <div className="text-3xl font-semibold text-white">16</div>
            <div className="text-sm text-zinc-500 mt-1">Specialized agents</div>
          </div>
          <div className="px-6">
            <div className="text-3xl font-semibold text-white">Any</div>
            <div className="text-sm text-zinc-500 mt-1">Agent runtime</div>
          </div>
          <div className="px-6">
            <div className="text-3xl font-semibold text-white">Zero</div>
            <div className="text-sm text-zinc-500 mt-1">Tolerance for &ldquo;fix stuff&rdquo; commits</div>
          </div>
        </div>
      </section>

      {/* Studio preview */}
      <section className="border-y border-zinc-800 bg-gradient-to-b from-zinc-900/30 to-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/30 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-400">Agenthood Studio</span>
          </div>
          <h2 className="text-3xl font-semibold text-white mb-4">
            Try the Society in your browser
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            Pick any agent, choose your provider, and start a live conversation.
            No install, no setup — just you and the agents.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/studio/playground"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Open Playground
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              About Studio
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            {[
              { label: "16 agents", desc: "architect, reviewer, tester, and more" },
              { label: "6 providers", desc: "Anthropic, OpenAI, Groq, Ollama, OpenCode" },
              { label: "SSE streaming", desc: "real-time token-by-token responses" },
              { label: "BYOK", desc: "use your own API keys" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="text-sm font-semibold text-zinc-200">{s.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents grid */}
      <section id="agents" className="max-w-6xl mx-auto px-6 pb-12 mt-18">
        <h2 className="text-3xl font-semibold text-white mb-4">Meet the team</h2>
        <p className="text-zinc-400 mb-12 max-w-2xl">
          Every role a real software team needs — available as a skill file with impeccable standards.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {agents.map((a) => (
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
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-3xl font-semibold text-white mb-4">How it works</h2>
        <p className="text-zinc-400 mb-12 max-w-2xl">
          Each agent is a single <code className="bg-zinc-800/70 text-zinc-300 px-1.5 py-0.5 rounded-md text-sm border border-zinc-700/50 font-mono">.md</code> file
          that describes a role, its responsibilities, standards, and how it communicates.
          Load one or all of them into Claude Code, Copilot, Gemini CLI, or any runtime that supports skill files.
          Or run them autonomously via the TypeScript CLI.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Install the Society", body: "npm install agenthood && npx agenthood init — interactive setup, hooks, and conventions in ~2 minutes." },
            { step: "02", title: "Load into your runtime", body: "Skill files install automatically. Or run members autonomously: agenthood run the-scribe \"write a commit message\"." },
            { step: "03", title: "Invoke any agent", body: "Ask the Reviewer to check your PR. Ask the Auditor to scan your auth flow. They know their role." },
          ].map((s) => (
            <div key={s.step} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="text-zinc-600 text-sm font-mono mb-3">{s.step}</div>
              <div className="text-white font-medium mb-2">{s.title}</div>
              <div className="text-zinc-400 text-sm leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">Your project deserves a full team.</h2>
          <p className="text-zinc-400 mb-8">Open source. No sign-up. Works with any agent runtime.</p>
          <a
            href="https://github.com/fworks-tech/agenthood"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-zinc-950 font-medium px-8 py-3 rounded-lg hover:bg-zinc-100 transition-colors inline-block"
          >
            Get started on GitHub →
          </a>
        </div>
      </section>

    </main>
  );
}
