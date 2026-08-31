// #TODO Workspaces: replace with workspace welcome state (centered message like Playground WelcomeTerminal) per spec.md:221-222
"use client";

import { useState, useEffect, useCallback } from "react";

const SAMPLE_PROMPTS = [
  { agent: "The Reviewer", icon: "🔍", prompt: "Review my pull request for security vulnerabilities" },
  { agent: "The Scribe", icon: "✍️", prompt: "Write a commit message for the current diff" },
  { agent: "The Debugger", icon: "🐛", prompt: "Diagnose why the CI pipeline is failing" },
];

const TYPING_SPEED = 30;
const PAUSE_AFTER_TYPE = 2000;
const PAUSE_AFTER_OUTPUT = 3000;

const OUTPUT_LINES = [
  { text: "✓ Analyzing codebase context...", color: "text-zinc-500" },
  { text: "✓ Reading staged changes (3 files, +47 -12)", color: "text-zinc-500" },
  { text: "✓ Generating structured response", color: "text-emerald-400" },
];

export default function WelcomeTerminal() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [outputLines, setOutputLines] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pausing" | "output" | "waiting">("typing");

  const current = SAMPLE_PROMPTS[promptIndex];

  const advancePrompt = useCallback(() => {
    setPromptIndex((i) => (i + 1) % SAMPLE_PROMPTS.length);
    setTypedText("");
    setShowOutput(false);
    setOutputLines(0);
    setPhase("typing");
  }, []);

  useEffect(() => {
    if (phase === "waiting") {
      const t = setTimeout(advancePrompt, PAUSE_AFTER_OUTPUT);
      return () => clearTimeout(t);
    }
  }, [phase, advancePrompt]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (typedText.length >= current.prompt.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("pausing");
      return;
    }
    const t = setTimeout(() => {
      setTypedText(current.prompt.slice(0, typedText.length + 1));
    }, TYPING_SPEED);
    return () => clearTimeout(t);
  }, [typedText, current.prompt, phase]);

  useEffect(() => {
    if (phase !== "pausing") return;
    const t = setTimeout(() => {
      setShowOutput(true);
      setPhase("output");
    }, PAUSE_AFTER_TYPE);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "output") return;
    if (outputLines >= OUTPUT_LINES.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("waiting");
      return;
    }
    const t = setTimeout(() => {
      setOutputLines((n) => n + 1);
    }, 280);
    return () => clearTimeout(t);
  }, [outputLines, phase]);

  return (
    <div data-testid="welcome-terminal" className="w-full max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{current.icon}</span>
        <div>
          <p className="text-sm font-medium text-zinc-300">{current.agent}</p>
          <p className="text-xs text-zinc-600">Try asking...</p>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-zinc-800/80 px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="ml-2 text-[10px] text-zinc-600">terminal</span>
        </div>
        <div className="px-4 py-3 font-mono text-sm min-h-[140px]">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">$</span>
            <span className="text-zinc-200 break-all">{typedText}</span>
            {phase === "typing" && (
              <span className="inline-block h-4 w-[2px] animate-pulse bg-emerald-400 align-text-bottom" />
            )}
          </div>
          {showOutput && (
            <div className="mt-2 space-y-1">
              {OUTPUT_LINES.slice(0, outputLines).map((line, i) => (
                <div key={i} className={`text-xs animate-[slide-up_0.2s_ease-out_forwards] ${line.color}`}>
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
