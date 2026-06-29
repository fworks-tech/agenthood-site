"use client";

import { useRef, useEffect } from "react";

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface LiveLogsProps {
  logs: LogEntry[];
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

export default function LiveLogs({ logs }: LiveLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <h3 className="text-xs font-medium text-zinc-500">Live Logs</h3>
        <span className="text-xs text-zinc-600">{logs.length} events</span>
      </div>
      <div
        ref={scrollRef}
        className="h-28 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
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
    </div>
  );
}
