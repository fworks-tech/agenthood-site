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
  "secret", "token", "authorization",
]);

function isKeySensitive(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

const VALUE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /[Bb]earer\s+[a-zA-Z0-9._-]+/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /https?:\/\/[^\s]+/,
];

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    let v = value;
    for (const p of VALUE_PATTERNS) {
      v = v.replace(p, "[REDACTED]");
    }
    return v;
  }
  return value;
}

function sanitize(meta: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return meta;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (isKeySensitive(key)) {
      safe[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      safe[key] = value.map((v) =>
        typeof v === "object" && v !== null
          ? sanitize(v as Record<string, unknown>, depth + 1)
          : redactValue(v),
      );
    } else if (typeof value === "object" && value !== null) {
      safe[key] = sanitize(value as Record<string, unknown>, depth + 1);
    } else {
      safe[key] = redactValue(value);
    }
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
