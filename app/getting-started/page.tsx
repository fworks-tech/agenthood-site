import Link from "next/link";
import Navbar from "../components/Navbar";

export default function GettingStarted() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
          Getting Started with Agenthood
        </h1>
        <p className="text-lg text-zinc-400 mb-12">
          A full AI engineering team — install in five minutes, invoke on demand.
        </p>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">What is Agenthood</h2>
          <p className="text-zinc-300 mb-4 leading-relaxed">
            Agenthood is a suite of 14 specialized AI agents that automate the work around your code:
            commit messages, PR reviews, security audits, changelogs, and more. Two modes:
          </p>
          <ul className="space-y-2 text-zinc-300 ml-6">
            <li className="list-disc">
              <strong className="text-white">Runtime mode</strong> (flagship) — agents run autonomously
              via the TypeScript CLI. They reason, use tools, and produce results without manual prompting.
            </li>
            <li className="list-disc">
              <strong className="text-white">Skill mode</strong> (alternative) — members load as Markdown
              skill files into Claude Code, Copilot, or any agent runtime that supports skill files.
            </li>
          </ul>
          <p className="text-zinc-400 mt-4 text-sm">
            Both modes use the same 14 member definitions. Choose runtime for automation, skill mode for assisted workflows.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Quick install</h2>
          <div className="space-y-3 mb-6">
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full">
              <span className="text-zinc-500">$</span>
              <code className="text-zinc-300">npm install --save-dev agenthood</code>
            </div>
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full">
              <span className="text-zinc-500">$</span>
              <code className="text-zinc-300">npx agenthood init          # interactive setup (~2 minutes)</code>
            </div>
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full">
              <span className="text-zinc-500">$</span>
              <code className="text-zinc-300">npx agenthood check         # verify everything is in place</code>
            </div>
          </div>
          <p className="text-zinc-400 text-sm">
            Requirements: Node.js 22+, <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">git</code>,
            and <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">gh</code> CLI for PR sync.
            No API key required for basic setup.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Essential commands</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-400 font-medium py-2 pr-4">Command</th>
                  <th className="text-left text-zinc-400 font-medium py-2">What it does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[
                  ["init", "Install hooks, templates, and member skills into your project"],
                  ["check", "Health check — confirm the Society is fully operational"],
                  ["run <member> \"<task>\"", "Invoke a member as an autonomous agent"],
                  ["list", "List all 14 members with activation status"],
                  ["pr-sync --pr <N>", "Auto-sync PR body with new commits (The Manuscript)"],
                  ["activate <member>", "Enable a member's skill file in your runtime"],
                  ["deactivate <member>", "Disable a member's skill file"],
                  ["oath", "Read the Society oath"],
                  ["eject", "Remove all Society files from your project"],
                ].map(([cmd, desc]) => (
                  <tr key={cmd}>
                    <td className="py-2 pr-4">
                      <code className="text-emerald-400 font-mono text-xs">{cmd}</code>
                    </td>
                    <td className="py-2 text-zinc-300">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Your first commit workflow</h2>
          <ol className="space-y-3 text-zinc-300 ml-6 list-decimal">
            <li><strong className="text-white">Write code</strong> — make changes in your project.</li>
            <li><strong className="text-white">Stage</strong> — <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">git add -p</code></li>
            <li>
              <strong className="text-white">Commit</strong> — <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">git commit</code>.
              The Doorman validates your message against conventional commits. If it fails, you get a clear reason and a suggestion.
            </li>
            <li>
              <strong className="text-white">Push</strong> — pre-push hooks run tests before the branch leaves your machine.
            </li>
            <li>
              <strong className="text-white">Open a PR</strong> — the PR body is pre-filled with the Society&apos;s template
              (<code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">## What changed</code>,
              <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">## Why</code>,
              <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">## How to test</code>).
            </li>
            <li>
              <strong className="text-white">Review</strong> — The Reviewer checks correctness, security, performance,
              maintainability, and test coverage.
            </li>
            <li>
              <strong className="text-white">Release</strong> — The Herald determines the semver bump, generates the
              changelog, and publishes to npm.
            </li>
          </ol>
          <p className="text-zinc-400 mt-4 text-sm">Every step is automated. Every step has a member responsible.</p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">CI pipeline</h2>
          <p className="text-zinc-300 mb-4">
            The Society ships 12 workflows that enforce standards on every push and PR:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-400 font-medium py-2 pr-4">Workflow</th>
                  <th className="text-left text-zinc-400 font-medium py-2 pr-4">Member</th>
                  <th className="text-left text-zinc-400 font-medium py-2">What it does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[
                  ["commitlint.yml", "The Doorman", "Validates commit messages match conventional commits"],
                  ["auto-assign.yml", "The Scribe", "Assigns an owner to new issues and PRs"],
                  ["labeler.yml", "The Scribe", "Labels PRs by changed file paths"],
                  ["scribe-pr-body.yml", "The Reviewer", "Reviews every pushed diff via LLM, posts findings as PR comment"],
                  ["herald.yml", "The Herald", "Posts a CI summary comment on every PR"],
                  ["semantic-release.yml", "The Herald", "Automated release and npm publish"],
                  ["auditor.yml", "The Auditor", "Scans for secrets and credentials"],
                  ["librarian.yml", "The Librarian", "Checks documentation stays in sync with code"],
                  ["sentinel.yml", "The Sentinel", "Validates member file structure and integrity"],
                  ["tester.yml", "The Tester", "Runs the full test suite"],
                  ["warden.yml", "The Warden", "Enforces file size and code health limits"],
                  ["vscode-extension.yml", "The Envoy", "Builds and tests the VS Code extension"],
                ].map(([wf, member, desc]) => (
                  <tr key={wf}>
                    <td className="py-2 pr-4">
                      <code className="text-emerald-400 font-mono text-xs">{wf}</code>
                    </td>
                    <td className="py-2 pr-4 text-zinc-300">{member}</td>
                    <td className="py-2 text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-400 mt-4 text-sm">These run on GitHub Actions. Every check must pass before merge.</p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">The Manuscript — PR sync</h2>
          <p className="text-zinc-300 mb-4 leading-relaxed">
            The Scribe keeps PR descriptions accurate as new commits land. A{" "}
            <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">{`<!-- pr-sync: sha=... -->`}</code>{" "}
            marker splits the body into two zones: your narrative above, auto-generated content below.
          </p>
          <div className="space-y-3 mb-4">
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full">
              <span className="text-zinc-500">#</span>
              <code className="text-zinc-300">npx agenthood pr-sync --pr 42</code>
            </div>
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full">
              <span className="text-zinc-500">#</span>
              <code className="text-zinc-300">npx agenthood pr-sync --pr 42 --dry-run</code>
            </div>
            <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full">
              <span className="text-zinc-500">#</span>
              <code className="text-zinc-300">agenthood run the-scribe &quot;sync PR #42&quot;</code>
            </div>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            On each run, The Scribe detects new commits since the last sync, updates the{" "}
            <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">## What Changed</code> section,
            and posts a reviewer comment. Your{" "}
            <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">## Why</code> and{" "}
            <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">## How to Test</code>{" "}
            sections are never touched.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Configuration</h2>
          <p className="text-zinc-300 mb-4">
            The Society reads from <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">.agenthood/config.json</code>,
            scaffolded by <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">init</code>:
          </p>
          <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm overflow-x-auto mb-6">
            <code className="text-zinc-300">{`{
  "version": "1",
  "runtime": "claude-code",
  "members": ["the-scribe", "the-architect", "the-reviewer", "..."],
  "hooks": { "hooksPath": ".husky" },
  "conventions": {
    "commitTemplate": ".gitmessage",
    "commitlintConfig": "commitlint.config.ts"
  }
}`}</code>
          </pre>

          <h3 className="text-lg font-semibold text-white mb-3">Key environment variables</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-400 font-medium py-2 pr-4">Variable</th>
                  <th className="text-left text-zinc-400 font-medium py-2 pr-4">Required for</th>
                  <th className="text-left text-zinc-400 font-medium py-2">Default</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[
                  ["GROQ_API_KEY", "Runtime mode (free at console.groq.com)", "—"],
                  ["ANTHROPIC_API_KEY", "Runtime mode, high-complexity tasks", "—"],
                  ["OPENAI_API_KEY", "Runtime mode (fallback provider)", "—"],
                  ["GITHUB_TOKEN", "PR sync (auto-set in CI)", "—"],
                ].map(([varName, req, def]) => (
                  <tr key={varName}>
                    <td className="py-2 pr-4">
                      <code className="text-emerald-400 font-mono text-xs">{varName}</code>
                    </td>
                    <td className="py-2 pr-4 text-zinc-300">{req}</td>
                    <td className="py-2 text-zinc-400">{def}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-400 mt-4 text-sm">
            No API key is needed for skill-file mode or for <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs">pr-sync</code> in CI.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Alternative path: skill files</h2>
          <p className="text-zinc-300 mb-4">
            If you use Claude Code, Copilot, or another assistant, load members as skill files:
          </p>
          <div className="inline-flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-sm w-full mb-4">
            <span className="text-zinc-500">$</span>
            <code className="text-zinc-300">npx agenthood init</code>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            The assistant loads the member&apos;s SKILL.md as context. Ask the Reviewer to check your PR,
            ask the Auditor to scan your auth flow. They know their role.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Next steps</h2>
          <ul className="space-y-2 text-zinc-300 ml-6 list-disc">
            <li><Link href="/academy/skills-reference/" className="text-emerald-400 hover:text-emerald-300 transition-colors">Skills Reference</Link> — all 14 members, their tools, and invocation syntax</li>
            <li><Link href="/academy/level-1-genai-rag-basics/" className="text-emerald-400 hover:text-emerald-300 transition-colors">Level 1: GenAI & RAG Basics</Link> — LLMs, prompt engineering, RAG</li>
            <li><Link href="/academy/level-2-agent-essentials/" className="text-emerald-400 hover:text-emerald-300 transition-colors">Level 2: AI Agent Essentials</Link> — memory, planning, multi-agent</li>
            <li><Link href="/academy/level-3-advanced-skills/" className="text-emerald-400 hover:text-emerald-300 transition-colors">Level 3: Advanced Agent Skills</Link> — integration, performance, production</li>
            <li><Link href="/adr/" className="text-emerald-400 hover:text-emerald-300 transition-colors">Architecture Decision Records</Link> — why the Society is built the way it is</li>
          </ul>
        </section>

        <footer className="border-t border-zinc-800 pt-8 flex items-center justify-between text-sm text-zinc-600">
          <span className="flex items-center gap-3">
            <span>
              agenthood · by{" "}
              <a href="https://flabs.tech" className="hover:text-zinc-400 transition-colors">
                Fabio Ritzel Borges
              </a>
            </span>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">v2.0.0</span>
          </span>
          <a href="https://github.com/fworks-tech/agenthood" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
