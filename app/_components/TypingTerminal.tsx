"use client";

import { useEffect, useState, useRef } from "react";

interface TypingTerminalProps {
  startTyping: boolean;
}

interface TerminalExample {
  command: string;
  outputLines: string[];
  status: string;
}

const EXAMPLES: TerminalExample[] = [
  {
    command: 'agenthood run the-builder "fix the session timeout bug in auth"',
    outputLines: [
      "",
      "✓ fix(auth): resolve session timeout on concurrent logins",
      "",
      "  - Add mutex lock to session token refresh",
      "  - Add regression test for race condition",
      "",
    ],
    status: "Done — 3 files changed, tests passing",
  },
  {
    command: 'agenthood run the-scribe "write a commit message for the current diff"',
    outputLines: [
      "",
      "✓ feat(auth): add rate limiting to login endpoint",
      "",
      "  - 5 attempts per minute per IP",
      "  - Returns 429 with Retry-After header",
      "",
    ],
    status: "Done — commit message ready",
  },
  {
    command: 'agenthood run the-debugger "diagnose why the CI pipeline is failing"',
    outputLines: [
      "",
      "✓ Root cause: flaky integration test hits real DB",
      "",
      "  - test_checkout.py:42 depends on seed data order",
      "  - Fix: mock the DB or pin the seed fixture",
      "",
    ],
    status: "Done — 1 root cause, 1 fix suggested",
  },
  {
    command: 'agenthood run the-reviewer "review the open PR #128"',
    outputLines: [
      "",
      "✓ 2 blocking issues, 1 suggestion",
      "",
      "  - blocking: unbounded query in getOrders()",
      "  - blocking: secrets logged in auth.ts:88",
      "",
    ],
    status: "Done — review posted",
  },
  {
    command: 'agenthood run the-tester "write tests for the checkout flow"',
    outputLines: [
      "",
      "✓ 12 tests generated, 3 edge cases found",
      "",
      "  - empty cart, expired card, partial refund",
      "  - coverage: 61% → 89%",
      "",
    ],
    status: "Done — 12 tests passing",
  },
  {
    command: 'agenthood run the-auditor "scan the auth flow for vulnerabilities"',
    outputLines: [
      "",
      "✓ 1 critical, 2 medium findings",
      "",
      "  - critical: JWT verified with alg=none fallback",
      "  - medium: session tokens never rotated",
      "",
    ],
    status: "Done — security report ready",
  },
  {
    command: 'agenthood run the-architect "plan the notifications feature"',
    outputLines: [
      "",
      "✓ Spec ready: 4 tasks, 1 ADR drafted",
      "",
      "  - queue-based delivery, retry with backoff",
      "  - ADR-021: notification provider abstraction",
      "",
    ],
    status: "Done — spec + ADR written",
  },
  {
    command: 'agenthood run the-herald "prepare release notes for v2.1.0"',
    outputLines: [
      "",
      "✓ v2.1.0 — minor bump, 14 commits analyzed",
      "",
      "  - 3 features, 6 fixes, 5 chores",
      "  - CHANGELOG.md updated",
      "",
    ],
    status: "Done — release notes drafted",
  },
  {
    command: 'agenthood run the-warden "scan src/ for code smells"',
    outputLines: [
      "",
      "✓ 3 violations found",
      "",
      "  - god function: processOrder() — 240 lines",
      "  - dead code: 2 unused exports in utils/",
      "",
    ],
    status: "Done — quality report ready",
  },
  {
    command: 'agenthood run the-doorman "validate the PR before merge"',
    outputLines: [
      "",
      "✓ All checks passed",
      "",
      "  - conventional commit titles: ok",
      "  - branch naming: ok, CI: green",
      "",
    ],
    status: "Done — cleared to merge",
  },
  {
    command: 'agenthood run the-librarian "update the README setup steps"',
    outputLines: [
      "",
      "✓ README.md updated",
      "",
      "  - pnpm install replaced npm steps",
      "  - added env var table for local dev",
      "",
    ],
    status: "Done — 1 file changed",
  },
  {
    command: "agenthood list",
    outputLines: [
      "",
      "✓ 20 members available",
      "",
      "  the-strategist  the-architect  the-tester",
      "  the-builder     the-reviewer   the-auditor",
      "  … run any with: agenthood run <member> <task>",
      "",
    ],
    status: "Done — 20 members, 28 skills",
  },
];

const CHAR_SPEED = 35;
const LINE_DELAY = 280;
const PAUSE_AFTER_COMMAND = 400;
const PAUSE_AFTER_DONE = 3500;

export default function TypingTerminal({ startTyping }: TypingTerminalProps) {
  const [phase, setPhase] = useState<"idle" | "command" | "output" | "done">("idle");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [cmdIdx, setCmdIdx] = useState(0);
  const [outIdx, setOutIdx] = useState(0);
  const [outLineChars, setOutLineChars] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = EXAMPLES[exampleIdx];

  useEffect(() => {
    if (!startTyping || phase !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("command");
  }, [startTyping, phase]);

  // Cycle to the next example after a pause on "done"
  useEffect(() => {
    if (phase !== "done") return;
    timerRef.current = setTimeout(() => {
      setExampleIdx((i) => (i + 1) % EXAMPLES.length);
      setCmdIdx(0);
      setOutIdx(0);
      setOutLineChars(0);
      setPhase("command");
    }, PAUSE_AFTER_DONE);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // Type command characters
  useEffect(() => {
    if (phase !== "command") return;
    if (cmdIdx >= current.command.length) {
      timerRef.current = setTimeout(() => setPhase("output"), PAUSE_AFTER_COMMAND);
      return;
    }
    timerRef.current = setTimeout(() => setCmdIdx((i) => i + 1), CHAR_SPEED);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, cmdIdx, current.command]);

  // Type output lines
  useEffect(() => {
    if (phase !== "output") return;
    if (outIdx >= current.outputLines.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("done");
      return;
    }
    const line = current.outputLines[outIdx];
    if (outLineChars >= line.length) {
      timerRef.current = setTimeout(() => {
        setOutIdx((i) => i + 1);
        setOutLineChars(0);
      }, LINE_DELAY);
      return;
    }
    timerRef.current = setTimeout(() => setOutLineChars((c) => c + 1), 12);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, outIdx, outLineChars, current.outputLines]);

  const typedCmd = current.command.slice(0, cmdIdx);
  const visibleOutput = current.outputLines.slice(0, outIdx).join("\n")
    + (outIdx < current.outputLines.length ? current.outputLines[outIdx].slice(0, outLineChars) : "");

  // Split output into lines and color the checkmark
  const outputLines = visibleOutput.split("\n");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 font-mono text-sm overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <div className="w-3 h-3 rounded-full bg-zinc-700" />
        <div className="w-3 h-3 rounded-full bg-zinc-700" />
        <div className="w-3 h-3 rounded-full bg-zinc-700" />
        <span className="ml-2 text-xs text-zinc-600">terminal</span>
      </div>

      {/* Content */}
      <div className="p-4 min-h-[180px]">
        <div className="text-zinc-500 mb-1">$ <span className="text-zinc-200">{typedCmd}</span>{phase === "command" && <span className="animate-pulse text-emerald-400">▌</span>}</div>
        {phase !== "idle" && (
          <pre className="text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {outputLines.map((line, i) => (
              <span key={i}>
                {line.startsWith("✓") ? (
                  <span className="text-emerald-400">{line}</span>
                ) : (
                  line
                )}
                {i < outputLines.length - 1 ? "\n" : ""}
              </span>
            ))}
            {phase === "output" && <span className="animate-pulse text-emerald-400">▌</span>}
          </pre>
        )}
        {phase === "done" && (
          <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {current.status}
          </div>
        )}
      </div>
    </div>
  );
}
