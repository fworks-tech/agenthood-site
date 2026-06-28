import Link from "next/link";
import Navbar from "./components/Navbar";

const agents = [
  { name: "The Scribe", icon: "✍️", desc: "Commits, PRs, changelogs" },
  { name: "The Architect", icon: "🏗️", desc: "System design, ADRs, tech decisions" },
  { name: "The Reviewer", icon: "🔍", desc: "Code review, standards enforcement" },
  { name: "The Tester", icon: "🧪", desc: "TDD, coverage, edge cases" },
  { name: "The Debugger", icon: "🐛", desc: "Error triage, root cause analysis" },
  { name: "The Auditor", icon: "🔒", desc: "Security, vulnerability scanning, dependency audit" },
  { name: "The Herald", icon: "📦", desc: "Releases, versioning, changelogs" },
  { name: "The Librarian", icon: "📝", desc: "Documentation, API references" },
  { name: "The Doorman", icon: "🚪", desc: "Validation, branch protection, health checks" },
  { name: "The Oracle", icon: "🔮", desc: "Institutional knowledge, authoring templates" },
  { name: "The Envoy", icon: "🌐", desc: "Cross-provider translation, convention validation" },
  { name: "The Sentinel", icon: "👁️", desc: "Integrity, cross-member contradiction detection" },
  { name: "The Warden", icon: "⚖️", desc: "Code health, complexity enforcement" },
  { name: "The Steward", icon: "🧭", desc: "Context economy, provider cache strategies" },
  { name: "The Strategist", icon: "🎯", desc: "Goal refinement, requirement discovery" },
  { name: "The Operator", icon: "🩺", desc: "Runtime health, deployments, rollback" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />

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
          <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm">
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-300">npm install --save-dev agenthood</code>
          </div>
          <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm">
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-300">npx agenthood init</code>
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

      {/* Agents grid */}
      <section id="agents" className="max-w-6xl mx-auto px-6 pb-12 mt-18">
        <h2 className="text-3xl font-semibold text-white mb-4">Meet the team</h2>
        <p className="text-zinc-400 mb-12 max-w-2xl">
          Every role a real software team needs — available as a skill file with impeccable standards.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {agents.map((a) => (
            <div
              key={a.name}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors"
            >
              <div className="text-2xl mb-3">{a.icon}</div>
              <div className="text-white font-medium text-sm mb-1">{a.name}</div>
              <div className="text-zinc-500 text-xs leading-relaxed">{a.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-3xl font-semibold text-white mb-4">How it works</h2>
        <p className="text-zinc-400 mb-12 max-w-2xl">
          Each agent is a single <code className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-sm">.md</code> file
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

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8 max-w-6xl mx-auto flex items-center justify-between text-sm text-zinc-600  mt-8">
        <span className="flex items-center gap-3">
          <span>
            agenthood · by{" "}
            <a href="https://flabs.tech" className="hover:text-zinc-400 transition-colors">
              Fabio Ritzel Borges
            </a>
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
            v3.1.0
          </span>
        </span>
        <a
          href="https://github.com/fworks-tech/agenthood"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400 transition-colors"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}
