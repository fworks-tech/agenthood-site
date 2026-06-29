import Link from "next/link";

const FEATURES = [
  { label: "16 agents", desc: "architect, reviewer, tester, debugger, auditor, and more" },
  { label: "5 providers", desc: "Anthropic, OpenAI, Groq, Ollama, OpenCode" },
  { label: "Skill files", desc: "prompts synced from the agenthood repo" },
  { label: "Rate limited", desc: "server-side guardrails on every request" },
];

export default function StudioHubPage() {
  return (
    <div className="h-full bg-zinc-950">
      <section className="border border-zinc-800">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-400">Agenthood Studio</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Try the Society live
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
            Select any of the 16 AI agent members, pick your provider, and start a conversation.
            All requests are routed server-side through the agenthood runtime.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/studio/playground"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Open Playground
            </Link>
            <Link
              href="/getting-started"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Getting started
            </Link>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-emerald-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Talk to any member</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Each of the 16 Society members has its own system prompt synced from its SKILL.md file.
              Select one and start a conversation with their exact agent persona.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-blue-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Choose your provider</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Switch between Anthropic, OpenAI, Groq, Ollama, or your own OpenCode server.
              Adjust temperature, max tokens, and model per conversation.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-purple-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Server-side routing</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Every request goes through the agenthood LLMRouter with automatic failover.
              Rate limited, validated, and logged server-side. Your keys stay on the server.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-3 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 text-amber-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">Conversations saved</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Chat history persists in your browser between sessions.
              Switch between conversations, clear history, or start fresh.
            </p>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="text-center">
                <div className="text-2xl font-bold text-zinc-100">{f.label.split(" ")[0]}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
