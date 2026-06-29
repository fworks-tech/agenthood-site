type LogLevel = "info" | "warn" | "error";

interface LogEvent {
  level: LogLevel;
  event: string;
  timestamp: string;
  agentId?: string;
  error?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "content", "message", "prompt",
  "api_key", "apikey", "api-key",
  "secret", "token",
]);

function isKeySensitive(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    safe[key] = isKeySensitive(key) ? "[REDACTED]" : value;
  }
  return safe;
}

export function log(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const entry: LogEvent = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(meta),
  };

  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => log("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => log("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => log("error", event, meta),
};
