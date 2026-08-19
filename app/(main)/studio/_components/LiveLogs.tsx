"use client";

import { useRef, useState, useEffect } from "react";
import { Group, Text, Badge, Collapse, UnstyledButton, ActionIcon, Switch, Select } from "@mantine/core";
import { IconChevronDown, IconCopy } from "@tabler/icons-react";
import HelpTip from "./HelpTip";
import type { LogCategory, LogEntry, LogLevel } from "../_lib/log-types";
import { LOG_CATEGORIES } from "../_lib/log-types";

export type { LogEntry, LogLevel };

export type LogCategoryFilter = LogCategory | "all";

interface LiveLogsProps {
  logs: LogEntry[];
  open?: boolean;
  onToggle?: () => void;
  debugVisible?: boolean;
  onToggleDebug?: () => void;
  categoryFilter?: LogCategoryFilter;
  onCategoryFilter?: (category: LogCategoryFilter) => void;
}

const CATEGORY_OPTIONS: { value: LogCategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  ...LOG_CATEGORIES.map((c) => ({
    value: c,
    // "Config" would collide with the mobile bottom-bar Config button in DOM
    // text queries, whose dropdown stays mounted (hidden) via Mantine combobox.
    label: c === "config" ? "Configuration" : c.charAt(0).toUpperCase() + c.slice(1),
  })),
];

function getLevelColor(level: LogLevel) {
  switch (level) {
    case "error": return "red.4";
    case "warn": return "yellow.4";
    case "debug": return "zinc.6";
    default: return "emerald.4";
  }
}

function getBadgeColor(level: LogLevel) {
  switch (level) {
    case "error": return "red";
    case "warn": return "yellow";
    case "debug": return "gray";
    default: return "emerald";
  }
}

function formatForCopy(entry: LogEntry): string {
  const category = entry.category.toUpperCase();
  const detail = entry.detail ? ` — ${entry.detail}` : "";
  return `[${entry.time}] ${entry.level.toUpperCase()} [${category}] ${entry.message}${detail}`;
}

export default function LiveLogs({
  logs,
  open = true,
  onToggle,
  debugVisible = false,
  onToggleDebug,
  categoryFilter = "all",
  onCategoryFilter,
}: LiveLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, open]);

  const renderedLogs = logs.filter(
    (log) =>
      (debugVisible || log.level !== "debug") &&
      (categoryFilter === "all" || log.category === categoryFilter),
  );

  const handleCopy = async () => {
    const text = renderedLogs.map(formatForCopy).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyState("idle"), 1500);
  };

  return (
    <div className="border border-zinc-800 bg-zinc-950">
      <UnstyledButton
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-1.5 hover:bg-zinc-900 transition-colors"
      >
        <Group gap="xs">
          <IconChevronDown
            size={14}
            className="text-zinc-500 transition-transform duration-200"
            style={{ transform: open ? undefined : "rotate(-90deg)" }}
          />
          <Text size="xs" fw={500} c="zinc.5" className="flex items-center gap-1">
            Live Logs
            <HelpTip text="Real-time event log showing request routing, provider calls, errors, and system messages." />
          </Text>
        </Group>
        <Text size="xs" c="zinc.6">
          {renderedLogs.length}/{logs.length} events
        </Text>
      </UnstyledButton>
      <div className="flex items-center gap-2 border-t border-zinc-800/50 px-3 py-1">
        <ActionIcon
          variant="subtle"
          size="sm"
          color="gray"
          onClick={handleCopy}
          disabled={renderedLogs.length === 0}
          aria-label="Copy logs"
          title="Copy logs to clipboard"
        >
          <IconCopy size={14} />
        </ActionIcon>
        {copyState === "copied" && (
          <Text size="xs" c="emerald.5" aria-live="polite">Copied</Text>
        )}
        {copyState === "error" && (
          <Text size="xs" c="red.5" aria-live="polite">Copy failed — clipboard unavailable</Text>
        )}
        <Switch
          size="xs"
          label="Debug"
          checked={debugVisible}
          onChange={onToggleDebug}
          aria-label="Show debug logs"
        />
        <div className="ml-auto w-36">
          <Select
            size="xs"
            data={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(v) => onCategoryFilter?.((v as LogCategoryFilter) ?? "all")}
            aria-label="Filter logs by category"
            allowDeselect={false}
          />
        </div>
      </div>
      <Collapse expanded={open}>
        <div
          ref={scrollRef}
          className="h-20 md:h-28 overflow-y-auto border-t border-zinc-800/50"
        >
          <div className="px-3 py-2 font-mono text-[11px] leading-relaxed">
            {renderedLogs.length === 0 ? (
              <Group gap="xs">
                <Text size="xs" c="zinc.6" fs="italic">
                  {logs.length === 0 ? "Waiting for events..." : "No logs match the current filter."}
                </Text>
                <HelpTip text="Log entries appear here once you send a message or interact with an agent." />
              </Group>
            ) : (
              renderedLogs.map((log) => (
                <Group key={log.id} gap="sm" align="flex-start" className="animate-[slide-up_0.2s_ease-out_forwards]">
                  <Text size="xs" c="zinc.6" className="shrink-0">{log.time}</Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color={getBadgeColor(log.level)}
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <Text size="xs" c={getLevelColor(log.level)}>{log.message}</Text>
                  {log.detail && (
                    <Text size="xs" c="zinc.6" className="truncate max-w-[180px] shrink-0" title={log.detail}>
                      {log.detail}
                    </Text>
                  )}
                </Group>
              ))
            )}
          </div>
        </div>
      </Collapse>
    </div>
  );
}
