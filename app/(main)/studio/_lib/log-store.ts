import type { LogCategory, LogEntry, LogLevel } from "./log-types";

const STORAGE_KEY = "agenthood-studio-logs";
const MAX_LOGS = 200;

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatLogTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-US", { hour12: false });
}

export function createLogEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  detail?: string,
): LogEntry {
  return {
    id: generateId(),
    ts: Date.now(),
    time: formatLogTime(),
    level,
    category,
    message,
    detail,
  };
}

export function loadLogs(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_LOGS);
  } catch {
    return [];
  }
}

export function persistLogs(logs: LogEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch {
    /* sessionStorage full or unavailable */
  }
}

export function appendLog(current: LogEntry[], entry: LogEntry): LogEntry[] {
  const next = [...current, entry].slice(-MAX_LOGS);
  persistLogs(next);
  return next;
}
