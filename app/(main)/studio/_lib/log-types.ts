export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  | "system"
  | "captcha"
  | "agent"
  | "message"
  | "config"
  | "conversation"
  | "network";

export interface LogEntry {
  id: string;
  ts: number;
  time: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  detail?: string;
}

export const LOG_CATEGORIES: LogCategory[] = [
  "system",
  "captcha",
  "agent",
  "message",
  "config",
  "conversation",
  "network",
];

export function isLogLevel(value: string): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}

export function isLogCategory(value: string): value is LogCategory {
  return (LOG_CATEGORIES as string[]).includes(value);
}
