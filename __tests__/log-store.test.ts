import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createLogEntry,
  loadLogs,
  persistLogs,
  appendLog,
  formatLogTime,
} from "../app/(main)/studio/_lib/log-store";
import { isLogCategory, isLogLevel, LOG_CATEGORIES } from "../app/(main)/studio/_lib/log-types";

function makeFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => store.delete(k),
    setItem: (k: string, v: string) => store.set(k, v),
  };
}

describe("log-types", () => {
  it("recognizes every level in the LogLevel union", () => {
    for (const l of ["debug", "info", "warn", "error"]) {
      expect(isLogLevel(l)).toBe(true);
    }
    expect(isLogLevel("verbose")).toBe(false);
  });

  it("recognizes every category in LOG_CATEGORIES and rejects others", () => {
    for (const c of LOG_CATEGORIES) {
      expect(isLogCategory(c)).toBe(true);
    }
    expect(isLogCategory("bogus")).toBe(false);
  });

  it("has the seven planned categories", () => {
    expect(LOG_CATEGORIES.sort()).toEqual(
      ["system", "captcha", "agent", "message", "config", "conversation", "network"].sort(),
    );
  });
});

describe("log-store", () => {
  beforeEach(() => {
    const storage = makeFakeStorage();
    Object.defineProperty(globalThis, "window", { value: { sessionStorage: storage }, configurable: true });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("createLogEntry produces the full schema", () => {
    const entry = createLogEntry("warn", "captcha", "challenge required", "corr-123");
    expect(entry).toMatchObject({
      level: "warn",
      category: "captcha",
      message: "challenge required",
      detail: "corr-123",
    });
    expect(entry.id).toBeTruthy();
    expect(typeof entry.ts).toBe("number");
    expect(entry.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("formatLogTime returns HH:MM:SS", () => {
    expect(formatLogTime(new Date(2026, 0, 1, 13, 5, 9))).toBe("13:05:09");
  });

  it("loadLogs returns [] when nothing is stored", () => {
    expect(loadLogs()).toEqual([]);
  });

  it("persists logs and restores them via loadLogs", () => {
    const a = createLogEntry("info", "system", "first");
    const b = createLogEntry("error", "network", "boom", "req-1");
    persistLogs([a, b]);
    const restored = loadLogs();
    expect(restored).toHaveLength(2);
    expect(restored[0].message).toBe("first");
    expect(restored[1].detail).toBe("req-1");
  });

  it("appendLog returns a capped array of 200", () => {
    let logs: ReturnType<typeof createLogEntry>[] = [];
    for (let i = 0; i < 210; i++) {
      logs = appendLog(logs, createLogEntry("info", "system", `msg-${i}`));
    }
    expect(logs).toHaveLength(200);
    expect(logs[0].message).toBe("msg-10");
    expect(logs[199].message).toBe("msg-209");
  });

  it("appendLog persists the trimmed array", () => {
    const entry = createLogEntry("debug", "config", "persisted?", "d");
    appendLog([], entry);
    expect(loadLogs()).toHaveLength(1);
  });

  it("loadLogs tolerates corrupt JSON", () => {
    const storage = (globalThis as { window: { sessionStorage: Storage } }).window.sessionStorage;
    storage.setItem("agenthood-studio-logs", "{not-json");
    expect(loadLogs()).toEqual([]);
  });
});
