"use client";

import { useRef, useEffect } from "react";
import HelpTip from "./HelpTip";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface LiveLogsProps {
  logs: LogEntry[];
  open?: boolean;
  onToggle?: () => void;
}

function getLevelColor(level: string): string {
  switch (level) {
    case "error": return "text-red-400";
    case "warn": return "text-amber-400";
    default: return "text-emerald-400";
  }
}

function getLevelBadge(level: string): string {
  switch (level) {
    case "error": return "bg-red-900/40 text-red-300";
    case "warn": return "bg-amber-900/40 text-amber-300";
    default: return "bg-emerald-900/40 text-emerald-300";
  }
}

export default function LiveLogs({ logs, open = true, onToggle }: LiveLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, open]);

  return (
    <div className="border border-zinc-800 bg-zinc-950">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h3 className="flex items-center gap-1 text-xs font-medium text-zinc-500">
            Live Logs
            <HelpTip text="Real-time event log showing request routing, provider calls, errors, and system messages." />
          </h3>
        </div>
        <span className="text-xs text-zinc-600">{logs.length} events</span>
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="h-20 md:h-28 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed border-t border-zinc-800/50"
        >
          {logs.length === 0 ? (
            <p className="text-zinc-600 italic">Waiting for events...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="shrink-0 text-zinc-600">{log.time}</span>
                <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${getLevelBadge(log.level)}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className={getLevelColor(log.level)}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
