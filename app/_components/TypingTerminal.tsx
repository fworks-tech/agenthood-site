"use client";

import { useEffect, useState, useRef } from "react";

interface TypingTerminalProps {
  startTyping: boolean;
}

const COMMAND = 'agenthood run the-scribe "fix the login bug"';
const OUTPUT_LINES = [
  "",
  "✓ fix(auth): resolve session timeout on concurrent logins",
  "",
  "  - Add mutex lock to session token refresh",
  "  - Expire stale tokens after 30s idle",
  "  - Add regression test for race condition",
  "",
];

const CHAR_SPEED = 35;
const LINE_DELAY = 280;
const PAUSE_AFTER_COMMAND = 400;

export default function TypingTerminal({ startTyping }: TypingTerminalProps) {
  const [phase, setPhase] = useState<"idle" | "command" | "output" | "done">("idle");
  const [cmdIdx, setCmdIdx] = useState(0);
  const [outIdx, setOutIdx] = useState(0);
  const [outLineChars, setOutLineChars] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!startTyping || phase !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("command");
  }, [startTyping, phase]);

  // Type command characters
  useEffect(() => {
    if (phase !== "command") return;
    if (cmdIdx >= COMMAND.length) {
      timerRef.current = setTimeout(() => setPhase("output"), PAUSE_AFTER_COMMAND);
      return;
    }
    timerRef.current = setTimeout(() => setCmdIdx((i) => i + 1), CHAR_SPEED);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, cmdIdx]);

  // Type output lines
  useEffect(() => {
    if (phase !== "output") return;
    if (outIdx >= OUTPUT_LINES.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("done");
      return;
    }
    const line = OUTPUT_LINES[outIdx];
    if (outLineChars >= line.length) {
      timerRef.current = setTimeout(() => {
        setOutIdx((i) => i + 1);
        setOutLineChars(0);
      }, LINE_DELAY);
      return;
    }
    timerRef.current = setTimeout(() => setOutLineChars((c) => c + 1), 12);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, outIdx, outLineChars]);

  const typedCmd = COMMAND.slice(0, cmdIdx);
  const visibleOutput = OUTPUT_LINES.slice(0, outIdx).join("\n")
    + (outIdx < OUTPUT_LINES.length ? OUTPUT_LINES[outIdx].slice(0, outLineChars) : "");

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
            Done — 3 files changed
          </div>
        )}
      </div>
    </div>
  );
}
